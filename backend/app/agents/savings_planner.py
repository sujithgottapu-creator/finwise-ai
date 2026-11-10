from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import SavingsGoal
from app.services.calculations import to_decimal, calculate_goal_progress

class SavingsPlannerAgent:
    """Specialist Agent: Evaluates goal timelines, contribution requirements, and cross-goal contention."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def analyze(self) -> Dict[str, Any]:
        goals = self.db.query(SavingsGoal).filter(
            SavingsGoal.user_id == self.user_id,
            SavingsGoal.status == "active"
        ).all()

        if not goals:
            return {
                "agent": "Savings Planner",
                "status": "no_active_goals",
                "total_target": Decimal("0.00"),
                "total_saved": Decimal("0.00"),
                "total_monthly_required": Decimal("0.00"),
                "findings": ["No active savings goals found. Setting an initial 3-month emergency fund is recommended."]
            }

        total_target = Decimal("0.00")
        total_saved = Decimal("0.00")
        total_monthly_req = Decimal("0.00")
        goal_summaries: List[Dict[str, Any]] = []
        findings: List[str] = []

        for g in goals:
            target = to_decimal(g.target_amount)
            saved = to_decimal(g.current_saved_amount)
            total_target += target
            total_saved += saved

            prog = calculate_goal_progress(target, saved, g.target_date)
            req_m = prog["required_monthly_contribution"]
            total_monthly_req += req_m

            goal_summaries.append({
                "name": g.name,
                "target": float(target),
                "saved": float(saved),
                "completion_pct": prog["completion_percentage"],
                "required_monthly": float(req_m),
                "months_remaining": prog["months_remaining"],
                "is_past_deadline": prog["is_past_deadline"]
            })

            if prog["is_past_deadline"]:
                findings.append(f"Goal '{g.name}' has passed its target deadline with ₹{prog['remaining_amount']:,.2f} remaining.")
            else:
                findings.append(f"Goal '{g.name}' is {prog['completion_percentage']}% complete; requires ₹{req_m:,.2f}/month to achieve.")

        return {
            "agent": "Savings Planner",
            "status": "completed",
            "total_target": total_target,
            "total_saved": total_saved,
            "total_monthly_required": total_monthly_req,
            "goal_summaries": goal_summaries,
            "findings": findings
        }
