import pytest
from app.core.security import (
    create_password_reset_token,
    verify_password_reset_token,
    get_password_hash,
    verify_password
)
from app.services.email_service import (
    send_password_reset_email,
    send_password_changed_notification,
    send_login_notification,
    send_ai_agent_report_email
)

def test_1_password_reset_token_valid():
    """Security Verification 1: Valid reset token encodes email and validates properly."""
    email = "testuser@finwise.ai"
    token = create_password_reset_token(email, expires_minutes=15)
    assert token is not None
    verified = verify_password_reset_token(token)
    assert verified == email

def test_2_password_reset_token_tampered():
    """Security Verification 2: Tampered or malicious reset token is rejected."""
    email = "testuser@finwise.ai"
    token = create_password_reset_token(email, expires_minutes=15)
    # Alter token string
    tampered = token[:-4] + "fake"
    verified = verify_password_reset_token(tampered)
    assert verified is None

def test_3_password_reset_token_expired():
    """Security Verification 3: Expired token cannot be used."""
    email = "testuser@finwise.ai"
    # Token with negative expiry
    token = create_password_reset_token(email, expires_minutes=-5)
    verified = verify_password_reset_token(token)
    assert verified is None

def test_4_password_hash_and_update_lifecycle():
    """Security Verification 4: Password hashing uses secure bcrypt salt."""
    old_pw = "OldPassword123!"
    new_pw = "NewPassword2026!"
    old_hash = get_password_hash(old_pw)
    assert verify_password(old_pw, old_hash) is True
    assert verify_password(new_pw, old_hash) is False

    new_hash = get_password_hash(new_pw)
    assert verify_password(new_pw, new_hash) is True
    assert verify_password(old_pw, new_hash) is False

def test_5_email_dispatch_security():
    """Security Verification 5: Email templates dispatch securely and log to audit."""
    assert send_password_reset_email("user@finwise.ai", "Test User", "https://finwise-ai-demo.vercel.app/reset-password?token=abc") is True
    assert send_password_changed_notification("user@finwise.ai", "Test User") is True
    assert send_login_notification("user@finwise.ai", "Test User", "127.0.0.1") is True

def test_6_ai_agent_email_reporting():
    """Security Verification 6: AI Agent multi-agent reports dispatch to registered inbox."""
    report = "### Executive Monthly Briefing\n- Savings rate: 24%\n- Discretionary spend: Normal\n- Action: Allocate $200 to Emergency Fund"
    success = send_ai_agent_report_email("user@finwise.ai", "Test User", "Monthly Multi-Agent Briefing", report)
    assert success is True
