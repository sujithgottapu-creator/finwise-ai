from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, FinancialProfile, SavingsGoal, Budget, Category, AuditEvent
from app.schemas.schemas import OnboardingSubmit, FinancialProfileOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/status")
def onboarding_status(current_user: User = Depends(get_current_user)):
    return {
        "is_onboarded": current_user.profile.is_onboarded if current_user.profile else False,
        "profile": FinancialProfileOut.model_validate(current_user.profile) if current_user.profile else None
    }

@router.post("/submit")
def submit_onboarding(
    data: OnboardingSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.profile
    if not profile:
        profile = FinancialProfile(user_id=current_user.id)
        db.add(profile)

    # 1. Update Profile & User details
    current_user.display_name = data.profile.display_name
    current_user.currency = data.profile.currency.upper()
    
    profile.monthly_income = data.financials.monthly_income
    profile.income_frequency = data.financials.income_frequency
    profile.essential_expenses = data.financials.essential_expenses
    profile.discretionary_expenses = data.financials.discretionary_expenses
    profile.current_savings = data.financials.current_savings
    profile.total_debt = data.financials.total_debt
    profile.timezone = data.profile.timezone
    profile.age_range = data.profile.age_range
    profile.is_onboarded = True

    # 2. Create initial goals if provided
    for g in data.goals:
        goal = SavingsGoal(
            user_id=current_user.id,
            name=g.name,
            target_amount=g.target_amount,
            current_saved_amount=Decimal("0.00"),
            currency=current_user.currency,
            target_date=g.target_date,
            priority=g.priority,
            status="active"
        )
        db.add(goal)

    # 3. If user confirmed initial budget, auto-create standard starting budgets
    if data.initial_budget_confirmed:
        # Check standard categories
        standard_cats = [
            ("Housing", "expense", Decimal("0.35")),      # 35% of income
            ("Food & Groceries", "expense", Decimal("0.20")), # 20% of income
            ("Transport", "expense", Decimal("0.10")),       # 10% of income
            ("Lifestyle", "expense", Decimal("0.15")),       # 15% of income
        ]
        today = date.today()
        m_start = date(today.year, today.month, 1)
        if today.month == 12:
            m_end = date(today.year, 12, 31)
        else:
            m_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

        income = data.financials.monthly_income
        for c_name, c_type, pct in standard_cats:
            cat = db.query(Category).filter(
                Category.user_id == current_user.id,
                Category.name == c_name
            ).first()
            if not cat:
                cat = Category(
                    user_id=current_user.id,
                    name=c_name,
                    transaction_type=c_type,
                    icon="circle",
                    color="#16A36A"
                )
                db.add(cat)
                db.flush()

            budget_limit = (income * pct).quantize(Decimal("100.00"))
            if budget_limit > 0:
                b = Budget(
                    user_id=current_user.id,
                    category_id=cat.id,
                    period_start=m_start,
                    period_end=m_end,
                    limit_amount=budget_limit,
                    warning_threshold=Decimal("80.00")
                )
                db.add(b)

    audit = AuditEvent(
        user_id=current_user.id,
        action="ONBOARDING_COMPLETED",
        entity_type="financial_profile",
        entity_id=str(profile.id),
        details='{"initial_plan_saved": true}'
    )
    db.add(audit)
    db.commit()

    return {"message": "Onboarding completed successfully.", "is_onboarded": True}
