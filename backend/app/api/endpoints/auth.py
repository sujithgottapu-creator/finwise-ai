import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.ratelimit import check_rate_limit, client_ip
from app.core.security import (
    verify_password, get_password_hash, create_access_token, burn_password_check,
    generate_otp_code, hash_otp, otp_matches,
)
from app.models.models import User, FinancialProfile, AuditEvent, EmailOTP
from app.schemas.schemas import (
    UserRegister, UserLogin, Token, UserOut, PasswordForgot, PasswordReset,
    RegisterPending, EmailCodeVerify, ResendCode,
)
from app.api.deps import get_current_user
from app.services.email_service import (
    send_otp_email,
    send_password_changed_notification,
    send_login_notification,
    trigger_n8n_agent_webhook,
)

logger = logging.getLogger("finwise-auth")
router = APIRouter()

GENERIC_CODE_MESSAGE = "If that email can receive a code, we have sent one. It expires in {m} minutes."


def _now() -> datetime:
    # Stored as naive UTC to stay portable across SQLite / MySQL / PostgreSQL
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, user_id, action: str, details: dict | None = None):
    db.add(AuditEvent(
        user_id=user_id, action=action, entity_type="user",
        entity_id=str(user_id) if user_id else None,
        details=json.dumps(details) if details else None,
    ))


def _token_response(user: User) -> Token:
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    user_out = UserOut.model_validate(user)
    user_out.is_onboarded = user.profile.is_onboarded if user.profile else False
    return Token(access_token=token, token_type="bearer", user=user_out)


def _issue_otp(db: Session, user: User, purpose: str) -> None:
    """Creates a fresh code (replacing any old one), emails it, and enforces the resend cooldown."""
    email = user.email
    existing = db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose).first()
    now = _now()
    if existing and (now - existing.created_at).total_seconds() < settings.OTP_RESEND_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {settings.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.",
            headers={"Retry-After": str(settings.OTP_RESEND_COOLDOWN_SECONDS)},
        )

    code = generate_otp_code()
    if existing:
        existing.code_hash = hash_otp(email, purpose, code)
        existing.attempts = 0
        existing.created_at = now
        existing.expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    else:
        db.add(EmailOTP(
            email=email, purpose=purpose, code_hash=hash_otp(email, purpose, code),
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES), created_at=now,
        ))
    db.commit()

    if not send_otp_email(email, user.display_name, code, purpose):
        # Do not leave a usable code behind if nothing was delivered
        db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose).delete()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send the email right now. Please try again in a few minutes.",
        )


def _consume_otp(db: Session, email: str, purpose: str, code: str) -> None:
    """Validates a code. Raises 400 on any failure with a deliberately vague message."""
    bad = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired.")
    row = db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose).first()
    if not row:
        raise bad
    if row.expires_at < _now() or row.attempts >= settings.OTP_MAX_ATTEMPTS:
        db.delete(row)
        db.commit()
        raise bad
    if not otp_matches(row.code_hash, email, purpose, code):
        row.attempts += 1
        if row.attempts >= settings.OTP_MAX_ATTEMPTS:
            db.delete(row)
        db.commit()
        raise bad
    db.delete(row)  # single use
    db.commit()


@router.post("/register", response_model=RegisterPending)
def register(data: UserRegister, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"register:ip:{ip}", limit=10, window_seconds=3600)

    email = data.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    generic = RegisterPending(
        message="We sent a 6-digit code to your email. Enter it to finish creating your account.",
        email=email,
    )

    if existing and existing.email_verified:
        # Same response as a new signup so attackers cannot discover registered emails.
        return generic

    if existing:  # Unverified: the person never proved ownership, so allow retrying
        existing.password_hash = get_password_hash(data.password)
        existing.display_name = data.display_name
        existing.currency = data.currency.upper() if data.currency else "INR"
        user = existing
    else:
        user = User(
            email=email,
            password_hash=get_password_hash(data.password),
            display_name=data.display_name,
            currency=data.currency.upper() if data.currency else "INR",
            role="user",
            is_active=True,
            email_verified=False,
        )
        db.add(user)
        db.flush()
        db.add(FinancialProfile(user_id=user.id, timezone="Asia/Kolkata", is_onboarded=False))
        _audit(db, user.id, "USER_REGISTERED", {"status": "pending_email_verification"})
    db.commit()
    db.refresh(user)

    _issue_otp(db, user, "signup")
    return generic


@router.post("/verify-email", response_model=Token)
def verify_email(data: EmailCodeVerify, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(f"verify:ip:{client_ip(request)}", limit=20, window_seconds=600)
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or user.email_verified or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired.")

    _consume_otp(db, email, "signup", data.code)
    user.email_verified = True
    _audit(db, user.id, "EMAIL_VERIFIED")
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/resend-code")
def resend_code(data: ResendCode, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"otp:ip:{ip}", limit=10, window_seconds=3600)
    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    eligible = bool(user and user.is_active and (
        (data.purpose == "signup" and not user.email_verified) or
        (data.purpose == "reset" and user.email_verified)
    ))
    if eligible:
        _issue_otp(db, user, data.purpose)
    return {"message": GENERIC_CODE_MESSAGE.format(m=settings.OTP_EXPIRE_MINUTES)}


@router.post("/login", response_model=Token)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"login:ip:{ip}", limit=20, window_seconds=300)

    email = data.email.lower()
    user = db.query(User).filter(User.email == email).first()
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not user:
        burn_password_check(data.password)  # equalize timing with real accounts
        raise invalid

    now = _now()
    if user.locked_until and user.locked_until > now:
        burn_password_check(data.password)
        minutes = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Too many failed attempts. Try again in about {minutes} minute(s), or reset your password with an email code.",
        )

    if not verify_password(data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
            _audit(db, user.id, "ACCOUNT_LOCKED", {"ip": ip})
        db.commit()
        raise invalid

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been suspended.")

    if not user.email_verified:
        # Correct password but unverified email: send a fresh code and let the UI continue
        try:
            _issue_otp(db, user, "signup")
        except HTTPException as e:
            if e.status_code != status.HTTP_429_TOO_MANY_REQUESTS:
                raise
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "EMAIL_NOT_VERIFIED", "message": "Please verify your email. We sent you a new code."},
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    _audit(db, user.id, "USER_LOGIN", {"ip": ip})
    db.commit()

    try:
        send_login_notification(user.email, user.display_name, ip)
    except Exception:
        pass

    return _token_response(user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _audit(db, current_user.id, "USER_LOGOUT")
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    user_out = UserOut.model_validate(current_user)
    user_out.is_onboarded = current_user.profile.is_onboarded if current_user.profile else False
    return user_out


@router.post("/forgot-password")
async def forgot_password(data: PasswordForgot, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"forgot:ip:{ip}", limit=10, window_seconds=3600)
    email = data.email.lower()
    check_rate_limit(f"forgot:email:{email}", limit=5, window_seconds=3600)

    user = db.query(User).filter(User.email == email).first()
    if user and user.is_active and user.email_verified:
        try:
            _issue_otp(db, user, "reset")
        except HTTPException as e:
            # Cooldown hits are fine to hide; real delivery failures should be visible
            if e.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
                raise
        _audit(db, user.id, "PASSWORD_RESET_REQUESTED", {"ip": ip})
        db.commit()
        await trigger_n8n_agent_webhook("security.password_reset_requested", {"email": user.email})

    # Identical response whether or not the account exists. No tokens are ever returned.
    return {"message": GENERIC_CODE_MESSAGE.format(m=settings.OTP_EXPIRE_MINUTES)}


@router.post("/reset-password")
async def reset_password(data: PasswordReset, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"reset:ip:{ip}", limit=20, window_seconds=600)
    email = data.email.lower()

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active or not user.email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is invalid or has expired.")

    _consume_otp(db, email, "reset", data.code)

    user.password_hash = get_password_hash(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    _audit(db, user.id, "PASSWORD_RESET_COMPLETED", {"ip": ip})
    db.commit()

    try:
        send_password_changed_notification(user.email, user.display_name)
    except Exception:
        pass
    await trigger_n8n_agent_webhook("security.password_reset_completed", {"email": user.email})

    return {"message": "Password updated successfully. You can now sign in with your new password."}
