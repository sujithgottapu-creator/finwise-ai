from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Budget, Category, Transaction
from app.schemas.schemas import BudgetCreate, BudgetUpdate, BudgetOut
from app.api.deps import get_current_user
from app.services.calculations import to_decimal, calculate_budget_metrics

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
def list_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    # Find budgets covering today
    budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.period_start <= today,
        Budget.period_end >= today
    ).all()

    items = []
    total_limit = Decimal("0.00")
    total_spent = Decimal("0.00")

    for b in budgets:
        b_limit = to_decimal(b.limit_amount)
        total_limit += b_limit

        # Calculate actual spending in period
        txs = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.category_id == b.category_id,
            Transaction.transaction_type == "expense",
            Transaction.transaction_date >= b.period_start,
            Transaction.transaction_date <= b.period_end
        ).all()

        spent = sum(to_decimal(t.amount) for t in txs)
        total_spent += spent

        metrics = calculate_budget_metrics(b_limit, spent, b.warning_threshold)

        items.append({
            "id": b.id,
            "category_id": b.category_id,
            "category_name": b.category.name if b.category else "General Budget",
            "period_start": b.period_start,
            "period_end": b.period_end,
            "limit_amount": b_limit,
            "spent_amount": spent,
            "remaining_amount": metrics["remaining"],
            "usage_percentage": metrics["usage_percentage"],
            "warning_threshold": b.warning_threshold,
            "status": metrics["status"]
        })

    remaining_total = max(Decimal("0.00"), total_limit - total_spent)
    overall_usage = round(float((total_spent / total_limit) * Decimal("100.00")), 1) if total_limit > 0 else 0.0

    return {
        "items": items,
        "total_budget": total_limit,
        "total_spent": total_spent,
        "remaining_budget": remaining_total,
        "overall_usage_percentage": overall_usage,
        "health_status": "healthy" if overall_usage < 80 else ("warning" if overall_usage <= 100 else "exceeded")
    }

@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.limit_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Budget limit must be greater than zero.")

    cat = db.query(Category).filter(
        Category.id == data.category_id,
        (Category.user_id == current_user.id) | (Category.user_id == None)
    ).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found.")

    b = Budget(
        user_id=current_user.id,
        category_id=data.category_id,
        period_start=data.period_start,
        period_end=data.period_end,
        limit_amount=data.limit_amount,
        warning_threshold=data.warning_threshold
    )
    db.add(b)
    db.commit()
    db.refresh(b)

    return BudgetOut(
        id=b.id,
        category_id=b.category_id,
        category_name=cat.name,
        period_start=b.period_start,
        period_end=b.period_end,
        limit_amount=b.limit_amount,
        spent_amount=Decimal("0.00"),
        remaining_amount=b.limit_amount,
        usage_percentage=0.0,
        warning_threshold=b.warning_threshold,
        status="healthy"
    )

@router.patch("/{id}", response_model=BudgetOut)
def update_budget(
    id: int,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    b = db.query(Budget).filter(
        Budget.id == id,
        Budget.user_id == current_user.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found.")

    if data.limit_amount is not None:
        if data.limit_amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Limit must be positive.")
        b.limit_amount = data.limit_amount

    if data.warning_threshold is not None:
        b.warning_threshold = data.warning_threshold

    db.commit()
    db.refresh(b)

    # Calculate spent
    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.category_id == b.category_id,
        Transaction.transaction_type == "expense",
        Transaction.transaction_date >= b.period_start,
        Transaction.transaction_date <= b.period_end
    ).all()
    spent = sum(to_decimal(t.amount) for t in txs)
    metrics = calculate_budget_metrics(b.limit_amount, spent, b.warning_threshold)

    return BudgetOut(
        id=b.id,
        category_id=b.category_id,
        category_name=b.category.name if b.category else "General Budget",
        period_start=b.period_start,
        period_end=b.period_end,
        limit_amount=b.limit_amount,
        spent_amount=spent,
        remaining_amount=metrics["remaining"],
        usage_percentage=metrics["usage_percentage"],
        warning_threshold=b.warning_threshold,
        status=metrics["status"]
    )

@router.delete("/{id}")
def delete_budget(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    b = db.query(Budget).filter(
        Budget.id == id,
        Budget.user_id == current_user.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found.")

    db.delete(b)
    db.commit()
    return {"message": "Budget deleted successfully.", "id": id}

@router.post("/copy-previous")
def copy_previous_budget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    cur_start = date(today.year, today.month, 1)
    if today.month == 12:
        cur_end = date(today.year, 12, 31)
    else:
        cur_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

    prev_last = cur_start - timedelta(days=1)
    prev_first = prev_last.replace(day=1)

    previous_budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.period_start == prev_first,
        Budget.period_end == prev_last
    ).all()

    if not previous_budgets:
        raise HTTPException(status_code=404, detail="No budgets found for the previous month to copy.")

    copied_count = 0
    for pb in previous_budgets:
        # Check if already exists for this category in current month
        exists = db.query(Budget).filter(
            Budget.user_id == current_user.id,
            Budget.category_id == pb.category_id,
            Budget.period_start == cur_start
        ).first()
        if not exists:
            nb = Budget(
                user_id=current_user.id,
                category_id=pb.category_id,
                period_start=cur_start,
                period_end=cur_end,
                limit_amount=pb.limit_amount,
                warning_threshold=pb.warning_threshold
            )
            db.add(nb)
            copied_count += 1

    db.commit()
    return {"message": f"Copied {copied_count} budget category limits to current month."}
