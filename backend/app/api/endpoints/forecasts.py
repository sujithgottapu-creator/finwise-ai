import json
from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, FinancialProfile, ForecastScenario
from app.schemas.schemas import ForecastSimulateRequest, ForecastSimulateResult
from app.api.deps import get_current_user
from app.services.calculations import to_decimal, simulate_cash_flow_forecast

router = APIRouter()

@router.post("", response_model=ForecastSimulateResult)
def simulate_forecast(
    data: ForecastSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prof = current_user.profile
    starting_balance = to_decimal(prof.current_savings) if prof else Decimal("10000.00")
    
    income = data.custom_monthly_income if data.custom_monthly_income is not None else (
        to_decimal(prof.monthly_income) if prof else Decimal("50000.00")
    )
    expenses = data.custom_monthly_expenses if data.custom_monthly_expenses is not None else (
        to_decimal(prof.essential_expenses + prof.discretionary_expenses) if prof else Decimal("30000.00")
    )

    res = simulate_cash_flow_forecast(
        starting_balance=starting_balance,
        monthly_income=income,
        monthly_expenses=expenses,
        months=data.months,
        one_time_purchases=data.one_time_purchases,
        monthly_savings_contribution=data.monthly_savings_contribution,
        unexpected_expense_buffer=data.unexpected_expense_buffer,
        annual_investment_return_rate=data.annual_investment_return_rate
    )
    return res

@router.get("/scenarios")
def list_saved_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scenarios = db.query(ForecastScenario).filter(
        ForecastScenario.user_id == current_user.id
    ).order_by(ForecastScenario.created_at.desc()).all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "assumptions": json.loads(s.assumptions or "{}"),
            "created_at": s.created_at
        }
        for s in scenarios
    ]

@router.post("/scenarios")
def save_forecast_scenario(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    name = payload.get("name", "Custom Scenario")
    assumptions = payload.get("assumptions", {})
    projection = payload.get("projection", {})

    scenario = ForecastScenario(
        user_id=current_user.id,
        name=name,
        assumptions=json.dumps(assumptions),
        projection=json.dumps(projection)
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"message": "Scenario saved successfully.", "id": scenario.id}
