from datetime import date
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, SavingsGoal, GoalContribution, AuditEvent
from app.schemas.schemas import (
    SavingsGoalCreate, SavingsGoalUpdate, SavingsGoalOut, 
    GoalContributionCreate, GoalContributionOut
)
from app.api.deps import get_current_user
from app.services.calculations import to_decimal, calculate_goal_progress

router = APIRouter()

@router.get("", response_model=List[SavingsGoalOut])
def list_savings_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    results = []

    for g in goals:
        target = to_decimal(g.target_amount)
        saved = to_decimal(g.current_saved_amount)
        prog = calculate_goal_progress(target, saved, g.target_date)

        results.append(SavingsGoalOut(
            id=g.id,
            name=g.name,
            target_amount=target,
            current_saved_amount=saved,
            remaining_amount=prog["remaining_amount"],
            currency=g.currency,
            target_date=g.target_date,
            priority=g.priority,
            status="completed" if prog["is_completed"] else g.status,
            completion_percentage=prog["completion_percentage"],
            required_monthly_contribution=prog["required_monthly_contribution"],
            months_remaining=prog["months_remaining"],
            created_at=g.created_at
        ))

    return results

@router.post("", response_model=SavingsGoalOut, status_code=status.HTTP_201_CREATED)
def create_savings_goal(
    data: SavingsGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.target_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Target amount must be strictly positive.")

    goal = SavingsGoal(
        user_id=current_user.id,
        name=data.name.strip(),
        target_amount=data.target_amount,
        current_saved_amount=data.current_saved_amount,
        currency=data.currency.upper(),
        target_date=data.target_date,
        priority=data.priority,
        status="active"
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    prog = calculate_goal_progress(goal.target_amount, goal.current_saved_amount, goal.target_date)
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_saved_amount=goal.current_saved_amount,
        remaining_amount=prog["remaining_amount"],
        currency=goal.currency,
        target_date=goal.target_date,
        priority=goal.priority,
        status=goal.status,
        completion_percentage=prog["completion_percentage"],
        required_monthly_contribution=prog["required_monthly_contribution"],
        months_remaining=prog["months_remaining"],
        created_at=goal.created_at
    )

@router.patch("/{id}", response_model=SavingsGoalOut)
def update_savings_goal(
    id: int,
    data: SavingsGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == id,
        SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")

    if data.name is not None:
        goal.name = data.name.strip()
    if data.target_amount is not None:
        goal.target_amount = data.target_amount
    if data.target_date is not None:
        goal.target_date = data.target_date
    if data.priority is not None:
        goal.priority = data.priority
    if data.status is not None:
        goal.status = data.status

    db.commit()
    db.refresh(goal)

    prog = calculate_goal_progress(goal.target_amount, goal.current_saved_amount, goal.target_date)
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_saved_amount=goal.current_saved_amount,
        remaining_amount=prog["remaining_amount"],
        currency=goal.currency,
        target_date=goal.target_date,
        priority=goal.priority,
        status=goal.status,
        completion_percentage=prog["completion_percentage"],
        required_monthly_contribution=prog["required_monthly_contribution"],
        months_remaining=prog["months_remaining"],
        created_at=goal.created_at
    )

@router.delete("/{id}")
def delete_savings_goal(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == id,
        SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")

    db.delete(goal)
    db.commit()
    return {"message": "Savings goal deleted successfully.", "id": id}

@router.post("/{id}/contributions", response_model=GoalContributionOut, status_code=status.HTTP_201_CREATED)
def add_goal_contribution(
    id: int,
    data: GoalContributionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == id,
        SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")

    if data.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Contribution amount must be positive.")

    # Idempotency check to avoid duplicate contributions
    if data.idempotency_key:
        existing_dup = db.query(GoalContribution).filter(
            GoalContribution.user_id == current_user.id,
            GoalContribution.idempotency_key == data.idempotency_key
        ).first()
        if existing_dup:
            return GoalContributionOut.model_validate(existing_dup)

    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=current_user.id,
        amount=data.amount,
        contribution_date=data.contribution_date,
        notes=data.notes,
        idempotency_key=data.idempotency_key
    )
    db.add(contribution)

    # Atomically update goal balance
    goal.current_saved_amount = to_decimal(goal.current_saved_amount) + data.amount
    if goal.current_saved_amount >= goal.target_amount:
        goal.status = "completed"

    audit = AuditEvent(
        user_id=current_user.id,
        action="GOAL_CONTRIBUTION_ADDED",
        entity_type="savings_goal",
        entity_id=str(goal.id),
        details=f'{{"amount": {float(data.amount)}}}'
    )
    db.add(audit)

    db.commit()
    db.refresh(contribution)
    return GoalContributionOut.model_validate(contribution)

@router.get("/{id}/contributions", response_model=List[GoalContributionOut])
def list_goal_contributions(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == id,
        SavingsGoal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")

    contributions = db.query(GoalContribution).filter(
        GoalContribution.goal_id == id
    ).order_by(GoalContribution.contribution_date.desc()).all()

    return [GoalContributionOut.model_validate(c) for c in contributions]
