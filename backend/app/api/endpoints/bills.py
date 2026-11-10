import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, RecurringBill, Category, Transaction, AuditEvent
from app.schemas.schemas import RecurringBillCreate, RecurringBillUpdate, RecurringBillOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[RecurringBillOut])
def list_recurring_bills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bills = db.query(RecurringBill).filter(
        RecurringBill.user_id == current_user.id
    ).order_by(RecurringBill.next_due_date.asc()).all()

    today = date.today()
    results = []
    for b in bills:
        # Dynamically flag overdue if next_due_date is before today and status is upcoming
        b_status = b.status
        if b_status == "upcoming" and b.next_due_date < today:
            b_status = "overdue"

        results.append(RecurringBillOut(
            id=b.id,
            name=b.name,
            amount=b.amount,
            currency=b.currency,
            frequency=b.frequency,
            next_due_date=b.next_due_date,
            status=b_status,
            category_id=b.category_id,
            category_name=b.category.name if b.category else None,
            notes=b.notes
        ))
    return results

@router.post("", response_model=RecurringBillOut, status_code=status.HTTP_201_CREATED)
def create_recurring_bill(
    data: RecurringBillCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Amount must be strictly positive.")

    if data.category_id:
        cat = db.query(Category).filter(
            Category.id == data.category_id,
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")

    bill = RecurringBill(
        user_id=current_user.id,
        category_id=data.category_id,
        name=data.name.strip(),
        amount=data.amount,
        currency=data.currency.upper(),
        frequency=data.frequency,
        next_due_date=data.next_due_date,
        status="upcoming",
        notes=data.notes
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)

    return RecurringBillOut(
        id=bill.id,
        name=bill.name,
        amount=bill.amount,
        currency=bill.currency,
        frequency=bill.frequency,
        next_due_date=bill.next_due_date,
        status=bill.status,
        category_id=bill.category_id,
        category_name=bill.category.name if bill.category else None,
        notes=bill.notes
    )

@router.patch("/{id}", response_model=RecurringBillOut)
def update_recurring_bill(
    id: int,
    data: RecurringBillUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bill = db.query(RecurringBill).filter(
        RecurringBill.id == id,
        RecurringBill.user_id == current_user.id
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found.")

    if data.name is not None:
        bill.name = data.name.strip()
    if data.amount is not None:
        bill.amount = data.amount
    if data.frequency is not None:
        bill.frequency = data.frequency
    if data.next_due_date is not None:
        bill.next_due_date = data.next_due_date
    if data.status is not None:
        bill.status = data.status
    if data.notes is not None:
        bill.notes = data.notes
    if data.category_id is not None:
        cat = db.query(Category).filter(
            Category.id == data.category_id,
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")
        bill.category_id = data.category_id

    db.commit()
    db.refresh(bill)

    return RecurringBillOut(
        id=bill.id,
        name=bill.name,
        amount=bill.amount,
        currency=bill.currency,
        frequency=bill.frequency,
        next_due_date=bill.next_due_date,
        status=bill.status,
        category_id=bill.category_id,
        category_name=bill.category.name if bill.category else None,
        notes=bill.notes
    )

@router.delete("/{id}")
def delete_recurring_bill(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bill = db.query(RecurringBill).filter(
        RecurringBill.id == id,
        RecurringBill.user_id == current_user.id
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found.")

    db.delete(bill)
    db.commit()
    return {"message": "Recurring bill deleted successfully.", "id": id}

@router.post("/{id}/pay")
def mark_bill_paid(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bill = db.query(RecurringBill).filter(
        RecurringBill.id == id,
        RecurringBill.user_id == current_user.id
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found.")

    # Record expense transaction
    tx = Transaction(
        user_id=current_user.id,
        category_id=bill.category_id,
        amount=bill.amount,
        currency=bill.currency,
        transaction_type="expense",
        transaction_date=date.today(),
        description=f"Bill Payment: {bill.name}",
        notes=f"Automated payment entry for recurring {bill.frequency} bill"
    )
    db.add(tx)

    # Advance next_due_date based on frequency
    old_date = bill.next_due_date
    if bill.frequency == "weekly":
        bill.next_due_date = old_date + timedelta(days=7)
    elif bill.frequency == "quarterly":
        # Advance 3 months safely
        target_month = old_date.month + 3
        target_year = old_date.year + ((target_month - 1) // 12)
        norm_month = ((target_month - 1) % 12) + 1
        max_d = calendar.monthrange(target_year, norm_month)[1]
        bill.next_due_date = date(target_year, norm_month, min(old_date.day, max_d))
    elif bill.frequency == "yearly":
        # Handle leap year Feb 29 safely
        try:
            bill.next_due_date = date(old_date.year + 1, old_date.month, old_date.day)
        except ValueError:
            bill.next_due_date = date(old_date.year + 1, old_date.month, 28)
    else:  # monthly
        year = old_date.year + (old_date.month // 12)
        month = (old_date.month % 12) + 1
        max_d = calendar.monthrange(year, month)[1]
        bill.next_due_date = date(year, month, min(old_date.day, max_d))

    bill.status = "upcoming"

    audit = AuditEvent(
        user_id=current_user.id,
        action="BILL_MARKED_PAID",
        entity_type="recurring_bill",
        entity_id=str(bill.id),
        details=f'{{"paid_amount": {float(bill.amount)}, "advanced_to": "{bill.next_due_date.isoformat()}"}}'
    )
    db.add(audit)

    db.commit()
    return {
        "message": f"Bill '{bill.name}' marked as paid. Next due date set to {bill.next_due_date.isoformat()}.",
        "new_due_date": bill.next_due_date.isoformat()
    }
