import uuid
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import validate_password_strength
from app.models.models import EmailOTP, User
from app.api.endpoints.auth import _now

client = TestClient(app)
GOOD_PW = "Str0ng&Secret!2026"


def new_email():
    return f"u_{uuid.uuid4().hex[:10]}@example.com"


def register(email, password=GOOD_PW):
    return client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "display_name": "Test User", "currency": "INR",
    })


def verified_user(sent_codes):
    email = new_email()
    assert register(email).status_code == 200
    r = client.post("/api/v1/auth/verify-email", json={"email": email, "code": sent_codes[(email, "signup")]})
    assert r.status_code == 200
    return email


# ---------- password policy ----------
@pytest.mark.parametrize("pw", ["short1!A", "alllowercase123!", "ALLUPPERCASE123!", "NoNumbersHere!!", "NoSpecials12345", "Password123!x"[:9]])
def test_weak_passwords_rejected_at_signup(pw, sent_codes):
    assert register(new_email(), pw).status_code == 422


def test_password_cannot_contain_email_name():
    with pytest.raises(ValueError):
        validate_password_strength("johnsmith#Pass99", "johnsmith@example.com")


# ---------- signup + email verification ----------
def test_signup_requires_email_code_before_login(sent_codes):
    email = new_email()
    assert register(email).status_code == 200
    # Correct password but unverified email must not log in
    r = client.post("/api/v1/auth/login", json={"email": email, "password": GOOD_PW})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"


def test_wrong_signup_code_rejected_and_attempts_limited(sent_codes):
    email = new_email()
    register(email)
    real = sent_codes[(email, "signup")]
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(5):
        r = client.post("/api/v1/auth/verify-email", json={"email": email, "code": wrong})
        assert r.status_code == 400
    # After 5 failures even the real code is dead
    r = client.post("/api/v1/auth/verify-email", json={"email": email, "code": real})
    assert r.status_code == 400


def test_signup_does_not_reveal_existing_accounts(sent_codes):
    email = verified_user(sent_codes)
    again = register(email)
    fresh = register(new_email())
    assert again.status_code == fresh.status_code == 200
    assert set(again.json().keys()) == set(fresh.json().keys())
    assert "access_token" not in again.json()


# ---------- forgot / reset password with one-time code ----------
def test_forgot_password_response_identical_and_leaks_nothing(sent_codes):
    email = verified_user(sent_codes)
    known = client.post("/api/v1/auth/forgot-password", json={"email": email})
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": new_email()})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert "debug_token" not in known.json() and "token" not in known.text.lower()
    assert (email, "reset") in sent_codes


def test_reset_password_with_code_end_to_end(sent_codes):
    email = verified_user(sent_codes)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = sent_codes[(email, "reset")]
    new_pw = "Brand#New-Pass77"

    weak = client.post("/api/v1/auth/reset-password", json={"email": email, "code": code, "new_password": "weakpass"})
    assert weak.status_code == 422

    ok = client.post("/api/v1/auth/reset-password", json={"email": email, "code": code, "new_password": new_pw})
    assert ok.status_code == 200
    # code is single use
    again = client.post("/api/v1/auth/reset-password", json={"email": email, "code": code, "new_password": "An0ther#Pass99"})
    assert again.status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": email, "password": GOOD_PW}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": new_pw}).status_code == 200


def test_reset_code_is_bound_to_the_email(sent_codes):
    a = verified_user(sent_codes)
    b = verified_user(sent_codes)
    client.post("/api/v1/auth/forgot-password", json={"email": a})
    code_for_a = sent_codes[(a, "reset")]
    r = client.post("/api/v1/auth/reset-password", json={"email": b, "code": code_for_a, "new_password": "Hacked#Pass1234"})
    assert r.status_code == 400


def test_expired_reset_code_rejected(sent_codes):
    email = verified_user(sent_codes)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = sent_codes[(email, "reset")]
    db = SessionLocal()
    try:
        row = db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == "reset").first()
        row.expires_at = _now() - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()
    r = client.post("/api/v1/auth/reset-password", json={"email": email, "code": code, "new_password": "Fresh#Pass12345"})
    assert r.status_code == 400


def test_resend_cooldown_enforced(sent_codes):
    email = verified_user(sent_codes)
    assert client.post("/api/v1/auth/forgot-password", json={"email": email}).status_code == 200
    first = sent_codes[(email, "reset")]
    # Immediate second request is swallowed (no new code issued) but looks identical
    assert client.post("/api/v1/auth/forgot-password", json={"email": email}).status_code == 200
    assert sent_codes[(email, "reset")] == first


def test_codes_are_stored_hashed(sent_codes):
    email = verified_user(sent_codes)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = sent_codes[(email, "reset")]
    db = SessionLocal()
    try:
        row = db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == "reset").first()
        assert code not in row.code_hash and len(row.code_hash) == 64
    finally:
        db.close()


# ---------- brute force / lockout ----------
def test_account_locks_after_repeated_failures(sent_codes):
    email = verified_user(sent_codes)
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong#Guess123"})
        assert r.status_code == 401
    # Locked: even the correct password is refused
    r = client.post("/api/v1/auth/login", json={"email": email, "password": GOOD_PW})
    assert r.status_code == 423


def test_password_reset_clears_lockout(sent_codes):
    email = verified_user(sent_codes)
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong#Guess123"})
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = sent_codes[(email, "reset")]
    new_pw = "Unlock#Pass8899"
    assert client.post("/api/v1/auth/reset-password", json={"email": email, "code": code, "new_password": new_pw}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": email, "password": new_pw}).status_code == 200


def test_login_error_is_the_same_for_unknown_email_and_wrong_password(sent_codes):
    email = verified_user(sent_codes)
    a = client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong#Guess123"})
    b = client.post("/api/v1/auth/login", json={"email": new_email(), "password": "Wrong#Guess123"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_ip_rate_limit_blocks_login_flood():
    codes = [client.post("/api/v1/auth/login", json={"email": new_email(), "password": "x"}).status_code for _ in range(25)]
    assert 429 in codes


# ---------- hardening ----------
def test_security_headers_present():
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_cors_rejects_unknown_origin():
    r = client.options("/api/v1/auth/login", headers={
        "Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST",
    })
    assert "access-control-allow-origin" not in r.headers


def test_old_default_admin_password_is_not_seeded():
    db = SessionLocal()
    try:
        from app.core.security import verify_password
        admin = db.query(User).filter(User.email == "admin@finwise.ai").first()
        assert admin is None or not (admin.is_active and verify_password("Admin1234!", admin.password_hash))
    finally:
        db.close()
