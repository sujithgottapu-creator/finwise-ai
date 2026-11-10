from decimal import Decimal
from typing import Dict, Any, List, Tuple
from app.services.calculations import to_decimal

class PolicyValidationEngine:
    """
    Deterministic validation and policy layer.
    Enforces monetary integrity, constraint checks, approval policies and permission gates.
    """

    @staticmethod
    def validate_financial_inputs(income: Any, expenses: Any) -> Tuple[bool, List[str]]:
        errors = []
        try:
            d_income = to_decimal(income)
            d_expenses = to_decimal(expenses)
            if d_income < Decimal("0.00"):
                errors.append("Income cannot be negative.")
            if d_expenses < Decimal("0.00"):
                errors.append("Expenses cannot be negative.")
        except Exception as e:
            errors.append(f"Invalid monetary format: {str(e)}")
        return len(errors) == 0, errors

    @staticmethod
    def validate_affordability_request(
        amount: Decimal, 
        available_cash: Decimal, 
        upcoming_bills: Decimal,
        emergency_buffer: Decimal
    ) -> Dict[str, Any]:
        """
        Policy check for major purchase affordability:
        Can only afford if (available_cash - upcoming_bills - emergency_buffer) >= purchase_amount.
        """
        committed = upcoming_bills + emergency_buffer
        unencumbered_cash = max(Decimal("0.00"), available_cash - committed)
        can_afford = unencumbered_cash >= amount
        deficit = max(Decimal("0.00"), amount - unencumbered_cash)

        return {
            "can_afford": can_afford,
            "purchase_amount": amount,
            "available_cash": available_cash,
            "upcoming_bills_committed": upcoming_bills,
            "emergency_buffer_retained": emergency_buffer,
            "unencumbered_cash": unencumbered_cash,
            "deficit": deficit,
            "policy_rule": "Purchase must not deplete unencumbered cash flow or upcoming bill reserves."
        }

    @staticmethod
    def check_consequential_action_approval(action_type: str) -> bool:
        """
        Requires explicit user approval for any consequential state alteration.
        """
        consequential = [
            "modify_budget", 
            "create_budget", 
            "transfer_funds", 
            "delete_transaction", 
            "close_goal", 
            "record_debt_payoff"
        ]
        return action_type in consequential
