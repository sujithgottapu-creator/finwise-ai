from datetime import date
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Budget, Transaction
from app.services.calculations import to_decimal, calculate_budget_metrics

class BudgetPlannerAgent:
    """Specialist Agent: Audits category limits, detects budget overruns, and suggests adjustments."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def analyze(self) -> Dict[str, Any]:
        today = date.today()
        # Find active budgets
        budgets = self.db.query(Budget).filter(
            Budget.user_id == self.user_id,
            Budget.period_start <= today,
            Budget.period_end >= today
        ).all()

        if not budgets:
            return {
                "agent": "Budget Planner",
                "status": "no_active_budgets",
                "total_limit": Decimal("0.00"),
                "total_spent": Decimal("0.00"),
                "findings": ["No active budgets found for current period. Proposing a balanced 50/30/20 starting budget."],
                "proposal": {
                    "Housing": 15000,
                    "Food & Groceries": 9000,
                    "Transport": 4000,
                    "Lifestyle": 5000
                }
            }

        total_limit = Decimal("0.00")
        total_spent = Decimal("0.00")
        overruns: List[str] = []
        approaching_limits: List[str] = []

        for b in budgets:
            b_limit = to_decimal(b.limit_amount)
            total_limit += b_limit

            # Calculate spent for this category during budget period
            txs = self.db.query(Transaction).filter(
                Transaction.user_id == self.user_id,
                Transaction.category_id == b.category_id,
                Transaction.transaction_type == "expense",
                Transaction.transaction_date >= b.period_start,
                Transaction.transaction_date <= b.period_end
            ).all()

            spent = sum(to_decimal(t.amount) for t in txs)
            total_spent += spent

            metrics = calculate_budget_metrics(b_limit, spent, b.warning_threshold)
            c_name = b.category.name if b.category else f"Category #{b.category_id}"

            if metrics["status"] == "exceeded":
                overruns.append(f"{c_name} exceeded limit by ₹{spent - b_limit:,.2f} ({metrics['usage_percentage']}%)")
            elif metrics["status"] == "warning":
                approaching_limits.append(f"{c_name} has consumed {metrics['usage_percentage']}% of limit (₹{metrics['remaining']:,.2f} left)")

        findings = []
        if overruns:
            findings.extend(overruns)
        if approaching_limits:
            findings.extend(approaching_limits)
        if not overruns and not approaching_limits:
            findings.append("All category budgets are currently operating within established parameters.")

        return {
            "agent": "Budget Planner",
            "status": "completed",
            "total_limit": total_limit,
            "total_spent": total_spent,
            "overall_usage_percentage": round(float((total_spent / total_limit) * Decimal("100.00")), 1) if total_limit > 0 else 0.0,
            "findings": findings,
            "overruns": overruns,
            "approaching_limits": approaching_limits
        }
