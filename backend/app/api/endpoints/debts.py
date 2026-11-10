from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Debt, AuditEvent
from app.schemas.schemas import DebtCreate, DebtUpdate, DebtOut, DebtStrategyRequest, DebtStrategyResult
from app.api.deps import get_current_user
from app.services.calculations import to_decimal, calculate_debt_strategies

router = APIRouter()

@router.get("", response_model=List[DebtOut])
def list_debts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    debts = db.query(Debt).filter(Debt.user_id == current_user.id).all()
    return [DebtOut.model_validate(d) for d in debts]

@router.post("", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
def create_debt(
    data: DebtCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.outstanding_balance <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Outstanding balance must be positive.")

    debt = Debt(
        user_id=current_user.id,
        name=data.name.strip(),
        outstanding_balance=data.outstanding_balance,
        interest_rate=data.interest_rate,
        minimum_payment=data.minimum_payment,
        payment_frequency=data.payment_frequency,
        target_payoff_date=data.target_payoff_date
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return DebtOut.model_validate(debt)

@router.patch("/{id}", response_model=DebtOut)
def update_debt(
    id: int,
    data: DebtUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    debt = db.query(Debt).filter(
        Debt.id == id,
        Debt.user_id == current_user.id
    ).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt record not found.")

    if data.name is not None:
        debt.name = data.name.strip()
    if data.outstanding_balance is not None:
        debt.outstanding_balance = data.outstanding_balance
    if data.interest_rate is not None:
        debt.interest_rate = data.interest_rate
    if data.minimum_payment is not None:
        debt.minimum_payment = data.minimum_payment
    if data.target_payoff_date is not None:
        debt.target_payoff_date = data.target_payoff_date

    db.commit()
    db.refresh(debt)
    return DebtOut.model_validate(debt)

@router.delete("/{id}")
def delete_debt(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    debt = db.query(Debt).filter(
        Debt.id == id,
        Debt.user_id == current_user.id
    ).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt record not found.")

    db.delete(debt)
    db.commit()
    return {"message": "Debt record deleted successfully.", "id": id}

@router.post("/calculate-strategy", response_model=DebtStrategyResult)
def calculate_debt_payoff_strategy(
    data: DebtStrategyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    debts = db.query(Debt).filter(Debt.user_id == current_user.id).all()
    if not debts:
        return {
            "avalanche": {
                "months_to_payoff": 0,
                "total_interest_paid": Decimal("0.00"),
                "estimated_payoff_date": None,
                "details": []
            },
            "snowball": {
                "months_to_payoff": 0,
                "total_interest_paid": Decimal("0.00"),
                "estimated_payoff_date": None,
                "details": []
            },
            "recommended_strategy": "No outstanding debts recorded.",
            "interest_saved_with_avalanche": Decimal("0.00")
        }

    raw_debts = [
        {
            "name": d.name,
            "balance": d.outstanding_balance,
            "rate": d.interest_rate,
            "min_payment": d.minimum_payment
        }
        for d in debts
    ]

    res = calculate_debt_strategies(raw_debts, data.monthly_extra_payment)
    return res
