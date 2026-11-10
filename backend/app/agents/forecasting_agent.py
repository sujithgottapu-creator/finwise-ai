from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import RecurringBill, FinancialProfile, Transaction
from app.services.calculations import to_decimal, simulate_cash_flow_forecast

class ForecastingAgent:
    """Specialist Agent: Simulates upcoming cash flow, evaluates big-ticket purchases, and checks liquidity."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def evaluate_purchase_affordability(
        self, 
        purchase_amount: Decimal, 
        profile_income: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Answers: 'Can I afford a purchase of ₹X?'
        Checks income, recurring bills, baseline expenses, and models cash impact.
        """
        # Fetch profile
        prof = self.db.query(FinancialProfile).filter(FinancialProfile.user_id == self.user_id).first()
        income = profile_income or (to_decimal(prof.monthly_income) if prof and prof.monthly_income else Decimal("0.00"))
        
        # Fetch upcoming bills
        bills = self.db.query(RecurringBill).filter(
            RecurringBill.user_id == self.user_id,
            RecurringBill.status == "upcoming"
        ).all()
        upcoming_bills_total = sum(to_decimal(b.amount) for b in bills)

        # Essential expenses
        essentials = to_decimal(prof.essential_expenses) if prof and prof.essential_expenses else Decimal("0.00")
        current_savings = to_decimal(prof.current_savings) if prof and prof.current_savings else Decimal("0.00")

        # Discretionary surplus
        committed_monthly = essentials + upcoming_bills_total
        monthly_surplus = max(Decimal("0.00"), income - committed_monthly)

        # Simulation
        can_afford_cash = monthly_surplus >= purchase_amount
        can_afford_with_savings = (monthly_surplus + (current_savings * Decimal("0.50"))) >= purchase_amount

        impact = {
            "purchase_amount": float(purchase_amount),
            "monthly_income": float(income),
            "committed_expenses_and_bills": float(committed_monthly),
            "available_monthly_surplus": float(monthly_surplus),
            "current_savings_reserve": float(current_savings),
            "verdict": "Affordable from cash flow" if can_afford_cash else (
                "Affordable with partial savings allocation" if can_afford_with_savings else "Not currently advisable"
            ),
            "recommendation": (
                f"You have ₹{monthly_surplus:,.2f} in discretionary surplus after commitments, which comfortably covers this ₹{purchase_amount:,.2f} expenditure."
                if can_afford_cash else
                f"This ₹{purchase_amount:,.2f} purchase exceeds your single-month uncommitted surplus of ₹{monthly_surplus:,.2f}. If non-essential, split across 2 months or draw moderately from liquid savings while leaving your emergency fund intact."
            )
        }
        return {
            "agent": "Forecasting Agent",
            "task": "affordability_simulation",
            "result": impact
        }
