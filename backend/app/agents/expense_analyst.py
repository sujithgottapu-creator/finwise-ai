from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Transaction, Category
from app.services.calculations import to_decimal

class ExpenseAnalystAgent:
    """Specialist Agent: Analyzes spending patterns, category concentration, and unusual spikes."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def analyze(self) -> Dict[str, Any]:
        txs = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.transaction_type == "expense"
        ).all()

        if not txs:
            return {
                "agent": "Expense Analyst",
                "status": "insufficient_data",
                "total_spending": Decimal("0.00"),
                "category_breakdown": {},
                "top_category": None,
                "findings": ["No expense transactions recorded yet. Add transactions to unlock deep category insights."]
            }

        total_spending = sum(to_decimal(t.amount) for t in txs)
        
        # Category totals
        cats: Dict[str, Decimal] = {}
        for t in txs:
            c_name = t.category.name if t.category else "Uncategorized"
            cats[c_name] = cats.get(c_name, Decimal("0.00")) + to_decimal(t.amount)

        sorted_cats = sorted(cats.items(), key=lambda x: x[1], reverse=True)
        top_cat = sorted_cats[0] if sorted_cats else None

        findings = []
        if top_cat and total_spending > Decimal("0.00"):
            top_pct = round(float((top_cat[1] / total_spending) * Decimal("100.00")), 1)
            findings.append(f"Primary spending driver is {top_cat[0]}, representing {top_pct}% (₹{top_cat[1]:,.2f}) of recorded outflows.")

        if len(txs) > 0:
            avg_tx = total_spending / Decimal(len(txs))
            outliers = [t for t in txs if to_decimal(t.amount) > (avg_tx * Decimal("2.5"))]
            if outliers:
                findings.append(f"Identified {len(outliers)} notable transactions substantially higher than your average ticket size of ₹{avg_tx:,.2f}.")

        return {
            "agent": "Expense Analyst",
            "status": "completed",
            "total_spending": total_spending,
            "category_breakdown": {k: float(v) for k, v in cats.items()},
            "top_category": {"name": top_cat[0], "amount": float(top_cat[1])} if top_cat else None,
            "findings": findings
        }
