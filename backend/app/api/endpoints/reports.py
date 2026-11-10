import io
import csv
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Transaction, Category, Budget, SavingsGoal, Debt
from app.api.deps import get_current_user
from app.services.calculations import to_decimal, calculate_net_cash_flow, calculate_savings_rate

router = APIRouter()

@router.get("/monthly")
def get_monthly_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    year: Optional[int] = None,
    month: Optional[int] = None
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month

    start_date = date(target_year, target_month, 1)
    if target_month == 12:
        end_date = date(target_year, 12, 31)
    else:
        end_date = date(target_year, target_month + 1, 1) - timedelta(days=1)

    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    income = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "income")
    expenses = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "expense")
    net = calculate_net_cash_flow(income, expenses)
    rate = calculate_savings_rate(income, expenses)

    # Categories breakdown
    cat_map = {}
    for t in txs:
        if t.transaction_type == "expense":
            c_name = t.category.name if t.category else "Uncategorized"
            cat_map[c_name] = cat_map.get(c_name, Decimal("0.00")) + to_decimal(t.amount)

    category_breakdown = [
        {"category": k, "amount": float(v), "percentage": round(float((v / expenses) * 100), 1) if expenses > 0 else 0.0}
        for k, v in cat_map.items()
    ]
    category_breakdown.sort(key=lambda x: x["amount"], reverse=True)

    # Budgets adherence
    budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.period_start <= end_date,
        Budget.period_end >= start_date
    ).all()
    total_budgeted = sum(to_decimal(b.limit_amount) for b in budgets)

    # Savings goals active count
    goals_count = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.status == "active"
    ).count()

    # Active debts total
    debts = db.query(Debt).filter(Debt.user_id == current_user.id).all()
    total_debt = sum(to_decimal(d.outstanding_balance) for d in debts)

    return {
        "period": f"{start_date.strftime('%B %Y')}",
        "total_income": float(income),
        "total_expenses": float(expenses),
        "net_cash_flow": float(net),
        "savings_rate_pct": rate,
        "total_budgeted": float(total_budgeted),
        "budget_adherence_pct": round(float((expenses / total_budgeted) * 100), 1) if total_budgeted > 0 else 0.0,
        "active_goals_count": goals_count,
        "total_outstanding_debt": float(total_debt),
        "category_breakdown": category_breakdown
    }

@router.get("/annual")
def get_annual_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    year: Optional[int] = None
):
    target_year = year or date.today().year
    start_date = date(target_year, 1, 1)
    end_date = date(target_year, 12, 31)

    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    income = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "income")
    expenses = sum(to_decimal(t.amount) for t in txs if t.transaction_type == "expense")
    net = calculate_net_cash_flow(income, expenses)

    return {
        "year": target_year,
        "total_annual_income": float(income),
        "total_annual_expenses": float(expenses),
        "annual_net_surplus": float(net),
        "annual_savings_rate": calculate_savings_rate(income, expenses),
        "transaction_count": len(txs)
    }

@router.get("/export")
def export_monthly_report_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    start_date = date(today.year, today.month, 1)
    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["FinWise AI - Financial Summary Report", date.today().isoformat()])
    writer.writerow(["User", current_user.display_name, current_user.email])
    writer.writerow([])
    writer.writerow(["Transaction ID", "Date", "Description", "Type", "Amount (INR)", "Category"])

    for t in txs:
        writer.writerow([
            t.id,
            t.transaction_date.isoformat(),
            t.description,
            t.transaction_type,
            f"{t.amount:.2f}",
            t.category.name if t.category else "Uncategorized"
        ])

    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=finwise_report_{today.strftime('%Y_%m')}.csv"
    return response
