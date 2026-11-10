import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_multi_agent_chat_affordability_workflow():
    # Login as demo user
    login_res = client.post("/api/v1/auth/login", json={
        "email": "demo@finwise.ai",
        "password": "Demo1234!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ask affordability question
    chat_res = client.post("/api/v1/ai/chat", headers=headers, json={
        "message": "Can I afford a purchase of ₹10,000?"
    })
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "reply" in data
    assert "agent_steps" in data
    assert len(data["agent_steps"]) >= 3
    # Check that specialists participated
    agent_names = [step["agent"] for step in data["agent_steps"]]
    assert "Expense Analyst" in agent_names or "Forecasting Agent" in agent_names
    assert data["recommendation"] is not None

    rec_id = data["recommendation"]["id"]

    # Approve recommendation
    appr_res = client.post(f"/api/v1/ai/recommendations/{rec_id}/approve", headers=headers)
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "approved"

def test_multi_agent_spending_analysis_workflow():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "demo@finwise.ai",
        "password": "Demo1234!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    chat_res = client.post("/api/v1/ai/chat", headers=headers, json={
        "message": "Analyze my spending this month."
    })
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "Spending Analysis" in data["reply"] or "expenses" in data["reply"].lower()
    assert len(data["agent_steps"]) > 0

def test_debt_avalanche_strategy_api():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "demo@finwise.ai",
        "password": "Demo1234!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/debts/calculate-strategy", headers=headers, json={
        "monthly_extra_payment": 2000.00
    })
    assert res.status_code == 200
    data = res.json()
    assert "avalanche" in data
    assert "snowball" in data
    assert "recommended_strategy" in data
