import pytest
from datetime import date, timedelta
from decimal import Decimal
from app.services.calculations import (
    calculate_net_cash_flow,
    calculate_savings_rate,
    calculate_budget_metrics,
    calculate_goal_progress,
    calculate_debt_strategies,
    simulate_cash_flow_forecast
)

def test_cash_flow_and_savings_rate():
    # Regular positive cash flow
    income = Decimal("60000.00")
    expenses = Decimal("20000.00")
    assert calculate_net_cash_flow(income, expenses) == Decimal("40000.00")
    assert calculate_savings_rate(income, expenses) == 66.67

    # Negative cash flow (expenses exceed income)
    deficit_exp = Decimal("75000.00")
    assert calculate_net_cash_flow(income, deficit_exp) == Decimal("-15000.00")
    assert calculate_savings_rate(income, deficit_exp) == 0.0

    # Zero income handling
    assert calculate_savings_rate(Decimal("0.00"), expenses) == 0.0

def test_budget_metrics():
    limit = Decimal("15000.00")
    
    # Healthy (under 80%)
    spent_ok = Decimal("9000.00")
    res_ok = calculate_budget_metrics(limit, spent_ok, Decimal("80.00"))
    assert res_ok["remaining"] == Decimal("6000.00")
    assert res_ok["usage_percentage"] == 60.0
    assert res_ok["status"] == "healthy"

    # Warning (80% to 100%)
    spent_warn = Decimal("12500.00")
    res_warn = calculate_budget_metrics(limit, spent_warn, Decimal("80.00"))
    assert res_warn["usage_percentage"] == 83.33
    assert res_warn["status"] == "warning"

    # Exceeded (over 100%)
    spent_over = Decimal("16000.00")
    res_over = calculate_budget_metrics(limit, spent_over, Decimal("80.00"))
    assert res_over["remaining"] == Decimal("-1000.00")
    assert res_over["status"] == "exceeded"

def test_goal_progress():
    target = Decimal("50000.00")
    current = Decimal("20000.00")
    as_of = date(2026, 10, 1)
    target_date = date(2027, 4, 1) # 6 months away

    prog = calculate_goal_progress(target, current, target_date, as_of)
    assert prog["remaining_amount"] == Decimal("30000.00")
    assert prog["completion_percentage"] == 40.0
    assert prog["months_remaining"] == 6
    assert prog["required_monthly_contribution"] == Decimal("5000.00")
    assert not prog["is_completed"]

    # Completed goal
    prog_done = calculate_goal_progress(target, Decimal("55000.00"), target_date, as_of)
    assert prog_done["is_completed"]
    assert prog_done["required_monthly_contribution"] == Decimal("0.00")

    # Past deadline goal
    past_date = date(2026, 8, 1)
    prog_past = calculate_goal_progress(target, current, past_date, as_of)
    assert prog_past["is_past_deadline"]
    assert prog_past["required_monthly_contribution"] == Decimal("30000.00")

def test_debt_avalanche_vs_snowball():
    debts = [
        {"name": "Credit Card", "balance": Decimal("10000.00"), "rate": Decimal("24.0"), "min_payment": Decimal("500.00")},
        {"name": "Personal Loan", "balance": Decimal("5000.00"), "rate": Decimal("12.0"), "min_payment": Decimal("250.00")},
    ]
    res = calculate_debt_strategies(debts, extra_monthly_payment=Decimal("300.00"))
    assert "avalanche" in res
    assert "snowball" in res
    # Avalanche should pay equal or less total interest than Snowball
    assert res["avalanche"]["total_interest_paid"] <= res["snowball"]["total_interest_paid"]

def test_cash_flow_simulation():
    res = simulate_cash_flow_forecast(
        starting_balance=Decimal("20000.00"),
        monthly_income=Decimal("60000.00"),
        monthly_expenses=Decimal("40000.00"),
        months=6
    )
    assert len(res["timeline"]) == 6
    assert res["ending_balance_expected"] > Decimal("20000.00")
    assert len(res["assumptions"]) > 0
