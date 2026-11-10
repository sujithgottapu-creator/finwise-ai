import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def create_password_reset_token(email: str, expires_minutes: int = 15) -> str:
    """Generates a cryptographically signed, short-lived password reset token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": email.lower(),
        "purpose": "password_reset",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

def verify_password_reset_token(token: str) -> Optional[str]:
    """Decodes and validates a password reset token. Returns email if valid, None otherwise."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Password policy, one-time codes, and timing-safe helpers
# ---------------------------------------------------------------------------
import hashlib
import hmac
import re
import secrets

_COMMON_PASSWORDS = {
    "password", "password1", "password123", "passw0rd", "12345678", "123456789",
    "1234567890", "qwertyuiop", "qwerty123", "iloveyou", "admin1234", "welcome1",
    "letmein123", "abc12345", "finwise123", "demo1234", "changeme",
}

# A real bcrypt hash used to burn the same CPU time when an email does not exist,
# so attackers cannot tell registered emails apart by response time.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode("utf-8")


def burn_password_check(plain_password: str) -> None:
    verify_password(plain_password, _DUMMY_HASH)


def validate_password_strength(password: str, email: Optional[str] = None) -> str:
    """Raises ValueError with a user-readable message if the password is weak."""
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters long.")
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes long.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include a lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include an uppercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must include a number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include a special character.")
    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS:
        raise ValueError("That password is too common. Please choose a different one.")
    if email:
        local = email.split("@")[0].lower()
        if len(local) >= 4 and local in lowered:
            raise ValueError("Password must not contain your email name.")
    return password


def generate_otp_code() -> str:
    """Cryptographically secure 6-digit code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(email: str, purpose: str, code: str) -> str:
    """Keyed hash so a database leak does not reveal live codes."""
    msg = f"{email.lower()}|{purpose}|{code}".encode("utf-8")
    return hmac.new(settings.JWT_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def otp_matches(stored_hash: str, email: str, purpose: str, code: str) -> bool:
    return hmac.compare_digest(stored_hash, hash_otp(email, purpose, code))
