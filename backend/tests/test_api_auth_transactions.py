import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

import uuid

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_auth_login_demo_user():
    res = client.post("/api/v1/auth/login", json={
        "email": "demo@finwise.ai",
        "password": "Demo1234!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "demo@finwise.ai"

def test_auth_registration_and_isolation(sent_codes):
    test_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "password": "StrongPassword123!",
        "display_name": "Test User",
        "currency": "INR"
    })
    assert res.status_code == 200
    assert "access_token" not in res.json()  # no session until the email is verified
    verify = client.post("/api/v1/auth/verify-email", json={
        "email": test_email, "code": sent_codes[(test_email, "signup")]
    })
    assert verify.status_code == 200
    token = verify.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify user can access /auth/me
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["display_name"] == "Test User"

    # Add a transaction
    tx_res = client.post("/api/v1/transactions", headers=headers, json={
        "amount": 1500.50,
        "currency": "INR",
        "transaction_type": "expense",
        "transaction_date": str(date.today()),
        "description": "Weekly grocery staples"
    })
    assert tx_res.status_code == 201
    tx_id = tx_res.json()["id"]

    # Verify user sees only their transaction
    list_res = client.get("/api/v1/transactions", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1

    # Edit transaction
    patch_res = client.patch(f"/api/v1/transactions/{tx_id}", headers=headers, json={
        "description": "Weekly grocery staples updated"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["description"] == "Weekly grocery staples updated"

    # Delete transaction
    del_res = client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert del_res.status_code == 200

def test_dashboard_summary_with_demo_user():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "demo@finwise.ai",
        "password": "Demo1234!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    summary_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert float(data["total_income"]) >= 0
    assert float(data["total_expenses"]) >= 0
    assert "savings_rate" in data
