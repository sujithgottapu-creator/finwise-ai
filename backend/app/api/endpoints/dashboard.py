from datetime import date, timedelta
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.models.models import User, Transaction, Category, Budget, SavingsGoal, RecurringBill
from app.schemas.schemas import DashboardSummary, CashFlowPoint, SpendingCategoryBreakdown
from app.services.calculations import (
    to_decimal, calculate_net_cash_flow, calculate_savings_rate, calculate_goal_progress
)
from app.api.deps import get_current_user

router = APIRouter()

def get_month_date_range(year: int, month: int):
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year, 12, 31)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    return start_date, end_date

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    start_of_month, end_of_month = get_month_date_range(today.year, today.month)
    
    # Calculate current month's actual income & expenses
    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_of_month,
        Transaction.transaction_date <= end_of_month
    ).all()

    income = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "income")
    expenses = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "expense")

    net_cash_flow = calculate_net_cash_flow(income, expenses)
    savings_rate = calculate_savings_rate(income, expenses)

    # Previous month for change percentage
    first_of_prev_month = (start_of_month - timedelta(days=1)).replace(day=1)
    last_of_prev_month = start_of_month - timedelta(days=1)
    prev_txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= first_of_prev_month,
        Transaction.transaction_date <= last_of_prev_month
    ).all()
    prev_inc = sum(to_decimal(t.amount) for t in prev_txs if t.transaction_type == "income")
    prev_exp = sum(to_decimal(t.amount) for t in prev_txs if t.transaction_type == "expense")

    inc_pct = round(float(((income - prev_inc) / prev_inc) * 100), 1) if prev_inc > 0 else 0.0
    exp_pct = round(float(((expenses - prev_exp) / prev_exp) * 100), 1) if prev_exp > 0 else 0.0

    return DashboardSummary(
        total_income=income,
        total_expenses=expenses,
        net_cash_flow=net_cash_flow,
        savings_rate=savings_rate,
        income_change_pct=inc_pct,
        expense_change_pct=exp_pct,
        period_label=f"{today.strftime('%B %Y')}",
        currency=current_user.currency
    )

@router.get("/cash-flow", response_model=List[CashFlowPoint])
def get_dashboard_cash_flow(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    points = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Generate 6 trailing months strictly using verified transaction records
    for i in range(5, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1

        start_date, end_date = get_month_date_range(year, month)

        txs = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date
        ).all()

        m_inc = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "income")
        m_exp = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "expense")

        points.append(CashFlowPoint(
            month=month_names[month - 1],
            income=m_inc.quantize(Decimal("1.00")),
            expenses=m_exp.quantize(Decimal("1.00")),
            net=(m_inc - m_exp).quantize(Decimal("1.00"))
        ))

    return points

@router.get("/spending-breakdown", response_model=List[SpendingCategoryBreakdown])
def get_dashboard_spending_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    start_date, end_date = get_month_date_range(today.year, today.month)

    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == "expense",
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    cat_totals = {}
    cat_colors = {
        "Housing": "#16845d",
        "Food & Groceries": "#4c83df",
        "Lifestyle": "#9b79d7",
        "Transport": "#e4a64c",
        "Subscriptions": "#6366f1",
        "Healthcare": "#ef4444",
        "Utilities": "#f59e0b",
        "Other": "#b9c7bf"
    }

    for t in txs:
        c_name = t.category.name if t.category else "Other"
        c_id = t.category.id if t.category else None
        c_color = t.category.color if t.category and t.category.color else cat_colors.get(c_name, "#16A36A")
        
        if c_name not in cat_totals:
            cat_totals[c_name] = {"category_id": c_id, "amount": Decimal("0.00"), "color": c_color}
        cat_totals[c_name]["amount"] += to_decimal(t.amount)

    total_spent = sum(v["amount"] for v in cat_totals.values())
    if total_spent == Decimal("0.00"):
        return []

    breakdowns = []
    for c_name, data in cat_totals.items():
        pct = round(float((data["amount"] / total_spent) * Decimal("100.00")), 1)
        breakdowns.append(SpendingCategoryBreakdown(
            category_id=data["category_id"],
            category_name=c_name,
            color=data["color"],
            amount=data["amount"],
            percentage=pct
        ))

    # Sort descending by amount
    breakdowns.sort(key=lambda x: x.amount, reverse=True)
    return breakdowns
