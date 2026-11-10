import json
from decimal import Decimal
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    User, FinancialProfile, Transaction, Budget, SavingsGoal, 
    GoalContribution, RecurringBill, Debt, AuditEvent
)
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/profile")
def get_settings_profile(
    current_user: User = Depends(get_current_user)
):
    prof = current_user.profile
    return {
        "display_name": current_user.display_name,
        "email": current_user.email,
        "currency": current_user.currency,
        "timezone": prof.timezone if prof else "Asia/Kolkata",
        "monthly_income": float(prof.monthly_income) if prof else 0.0,
        "essential_expenses": float(prof.essential_expenses) if prof else 0.0,
        "discretionary_expenses": float(prof.discretionary_expenses) if prof else 0.0,
        "current_savings": float(prof.current_savings) if prof else 0.0,
        "is_onboarded": prof.is_onboarded if prof else False
    }

@router.patch("/profile")
def update_settings_profile(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if "display_name" in payload:
        current_user.display_name = str(payload["display_name"]).strip()
    if "currency" in payload:
        current_user.currency = str(payload["currency"]).strip().upper()

    prof = current_user.profile
    if not prof:
        prof = FinancialProfile(user_id=current_user.id)
        db.add(prof)

    if "timezone" in payload:
        prof.timezone = str(payload["timezone"])
    if "monthly_income" in payload:
        prof.monthly_income = Decimal(str(payload["monthly_income"]))
    if "essential_expenses" in payload:
        prof.essential_expenses = Decimal(str(payload["essential_expenses"]))
    if "discretionary_expenses" in payload:
        prof.discretionary_expenses = Decimal(str(payload["discretionary_expenses"]))
    if "current_savings" in payload:
        prof.current_savings = Decimal(str(payload["current_savings"]))

    db.commit()
    return {"message": "Profile settings updated successfully."}

@router.post("/export-data")
def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Collect all user records
    txs = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    bills = db.query(RecurringBill).filter(RecurringBill.user_id == current_user.id).all()
    debts = db.query(Debt).filter(Debt.user_id == current_user.id).all()

    audit = AuditEvent(
        user_id=current_user.id,
        action="USER_DATA_EXPORTED",
        entity_type="user",
        entity_id=str(current_user.id)
    )
    db.add(audit)
    db.commit()

    return {
        "user": {
            "id": current_user.id,
            "display_name": current_user.display_name,
            "email": current_user.email,
            "currency": current_user.currency,
            "created_at": current_user.created_at.isoformat()
        },
        "financial_profile": {
            "monthly_income": float(current_user.profile.monthly_income) if current_user.profile else 0,
            "current_savings": float(current_user.profile.current_savings) if current_user.profile else 0,
            "timezone": current_user.profile.timezone if current_user.profile else "Asia/Kolkata"
        },
        "transactions": [
            {
                "id": t.id,
                "date": t.transaction_date.isoformat(),
                "description": t.description,
                "amount": float(t.amount),
                "type": t.transaction_type,
                "category": t.category.name if t.category else None
            }
            for t in txs
        ],
        "budgets": [
            {
                "id": b.id,
                "category": b.category.name if b.category else None,
                "limit": float(b.limit_amount),
                "period_start": b.period_start.isoformat(),
                "period_end": b.period_end.isoformat()
            }
            for b in budgets
        ],
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target": float(g.target_amount),
                "saved": float(g.current_saved_amount),
                "status": g.status
            }
            for g in goals
        ],
        "recurring_bills": [
            {
                "id": rb.id,
                "name": rb.name,
                "amount": float(rb.amount),
                "frequency": rb.frequency,
                "next_due_date": rb.next_due_date.isoformat()
            }
            for rb in bills
        ],
        "debts": [
            {
                "id": d.id,
                "name": d.name,
                "balance": float(d.outstanding_balance),
                "interest_rate": float(d.interest_rate),
                "minimum_payment": float(d.minimum_payment)
            }
            for d in debts
        ]
    }

@router.delete("/account")
def delete_user_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    return {"message": "Account and all associated records have been permanently deleted.", "user_id": user_id}
