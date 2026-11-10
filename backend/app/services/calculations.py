from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional

def to_decimal(val: Any) -> Decimal:
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")

def calculate_net_cash_flow(income: Decimal, expenses: Decimal) -> Decimal:
    """Net cash flow = income - expenses."""
    return income - expenses

def calculate_savings_rate(income: Decimal, expenses: Decimal) -> float:
    """
    Savings rate = positive net cash flow / income * 100.
    Handles zero income and negative cash flow explicitly.
    """
    if income <= Decimal("0.00"):
        return 0.0
    net = income - expenses
    if net <= Decimal("0.00"):
        return 0.0
    rate = (net / income) * Decimal("100.00")
    return round(float(rate), 2)

def calculate_budget_metrics(limit: Decimal, spent: Decimal, warning_threshold: Decimal = Decimal("80.00")) -> Dict[str, Any]:
    """
    Calculates remaining budget, usage percentage and warning status.
    """
    remaining = limit - spent
    if limit > Decimal("0.00"):
        usage_pct = (spent / limit) * Decimal("100.00")
        usage_float = round(float(usage_pct), 2)
    else:
        usage_float = 100.0 if spent > Decimal("0.00") else 0.0

    warning_float = float(warning_threshold)
    if spent > limit:
        status = "exceeded"
    elif usage_float >= warning_float:
        status = "warning"
    else:
        status = "healthy"

    return {
        "limit": limit,
        "spent": spent,
        "remaining": remaining,
        "usage_percentage": usage_float,
        "status": status
    }

def calculate_goal_progress(
    target_amount: Decimal, 
    current_saved_amount: Decimal, 
    target_date: Optional[date] = None, 
    as_of: Optional[date] = None
) -> Dict[str, Any]:
    """
    Calculates remaining goal amount, completion %, months remaining and required monthly contribution.
    Handles past deadlines, completed targets and zero months remaining.
    """
    if as_of is None:
        as_of = date.today()
    
    target = max(Decimal("0.01"), target_amount)
    current = max(Decimal("0.00"), current_saved_amount)
    remaining = max(Decimal("0.00"), target - current)
    
    completion_pct = min(100.0, round(float((current / target) * Decimal("100.00")), 2))

    if remaining == Decimal("0.00"):
        return {
            "remaining_amount": Decimal("0.00"),
            "completion_percentage": 100.0,
            "months_remaining": 0,
            "required_monthly_contribution": Decimal("0.00"),
            "is_completed": True,
            "is_past_deadline": False
        }

    if target_date is None:
        # Default to 12 months horizon if no date specified
        months_remaining = 12
        required_monthly = (remaining / Decimal(months_remaining)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "remaining_amount": remaining,
            "completion_percentage": completion_pct,
            "months_remaining": months_remaining,
            "required_monthly_contribution": required_monthly,
            "is_completed": False,
            "is_past_deadline": False
        }

    # Month difference
    month_diff = (target_date.year - as_of.year) * 12 + (target_date.month - as_of.month)
    if target_date.day < as_of.day:
        month_diff -= 1

    if month_diff <= 0:
        return {
            "remaining_amount": remaining,
            "completion_percentage": completion_pct,
            "months_remaining": 0,
            "required_monthly_contribution": remaining,
            "is_completed": False,
            "is_past_deadline": True
        }

    required_monthly = (remaining / Decimal(month_diff)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "remaining_amount": remaining,
        "completion_percentage": completion_pct,
        "months_remaining": month_diff,
        "required_monthly_contribution": required_monthly,
        "is_completed": False,
        "is_past_deadline": False
    }

def calculate_debt_strategies(
    debts: List[Dict[str, Any]], 
    extra_monthly_payment: Decimal = Decimal("0.00"),
    max_months: int = 360
) -> Dict[str, Any]:
    """
    Deterministic comparison of Debt Avalanche (highest APR first) vs Debt Snowball (lowest balance first).
    debts: [{ "name": str, "balance": Decimal, "rate": Decimal (APR %), "min_payment": Decimal }]
    """
    def simulate(order_key, reverse: bool) -> Dict[str, Any]:
        # Deep copy debt records
        items = [
            {
                "name": d["name"],
                "balance": Decimal(str(d["balance"])),
                "monthly_rate": (Decimal(str(d["rate"])) / Decimal("100.00")) / Decimal("12.00"),
                "min_payment": Decimal(str(d["min_payment"]))
            }
            for d in debts if Decimal(str(d["balance"])) > Decimal("0.00")
        ]
        
        if not items:
            return {
                "months_to_payoff": 0,
                "total_interest_paid": Decimal("0.00"),
                "estimated_payoff_date": date.today().isoformat(),
                "details": []
            }

        total_interest = Decimal("0.00")
        month = 0
        details = []

        while month < max_months:
            active_items = [d for d in items if d["balance"] > Decimal("0.00")]
            if not active_items:
                break
            month += 1
            month_interest = Decimal("0.00")
            
            # Step 1: Accrue monthly interest
            for d in active_items:
                interest = (d["balance"] * d["monthly_rate"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                d["balance"] += interest
                month_interest += interest
                total_interest += interest

            # Step 2: Pay minimums
            extra_available = Decimal(str(extra_monthly_payment))
            for d in active_items:
                pay = min(d["balance"], d["min_payment"])
                d["balance"] -= pay

            # Step 3: Apply extra payment according to strategy order
            sorted_items = sorted(
                [d for d in active_items if d["balance"] > Decimal("0.00")],
                key=order_key,
                reverse=reverse
            )
            for d in sorted_items:
                if extra_available <= Decimal("0.00"):
                    break
                extra_pay = min(d["balance"], extra_available)
                d["balance"] -= extra_pay
                extra_available -= extra_pay

            remaining_total = sum(d["balance"] for d in items)
            if month <= 24 or remaining_total == 0 or month % 6 == 0:
                details.append({
                    "month": month,
                    "remaining_total": remaining_total.quantize(Decimal("0.01")),
                    "month_interest": month_interest.quantize(Decimal("0.01"))
                })

        return {
            "months_to_payoff": month,
            "total_interest_paid": total_interest.quantize(Decimal("0.01")),
            "estimated_payoff_date": None,
            "details": details
        }

    # Avalanche: sort by monthly_rate descending
    avalanche = simulate(lambda x: x["monthly_rate"], reverse=True)
    # Snowball: sort by balance ascending
    snowball = simulate(lambda x: x["balance"], reverse=False)

    interest_saved = max(Decimal("0.00"), snowball["total_interest_paid"] - avalanche["total_interest_paid"])
    recommended = "Debt Avalanche (saves ₹{:,.2f} in interest)".format(float(interest_saved)) if interest_saved > 0 else "Both strategies have equal interest cost"

    return {
        "avalanche": avalanche,
        "snowball": snowball,
        "recommended_strategy": recommended,
        "interest_saved_with_avalanche": interest_saved
    }

def simulate_cash_flow_forecast(
    starting_balance: Decimal,
    monthly_income: Decimal,
    monthly_expenses: Decimal,
    months: int = 12,
    one_time_purchases: Optional[List[Dict[str, Any]]] = None,
    monthly_savings_contribution: Decimal = Decimal("0.00"),
    unexpected_expense_buffer: Decimal = Decimal("0.00"),
    annual_investment_return_rate: Decimal = Decimal("0.00")
) -> Dict[str, Any]:
    """
    Deterministic cash flow simulator across n months.
    Produces expected, best-case (+10% income, -5% expenses) and adverse-case (-10% income, +15% expenses) projections.
    """
    if one_time_purchases is None:
        one_time_purchases = []

    # Map one time purchases by month index (1-based)
    one_time_by_month: Dict[int, Decimal] = {}
    for p in one_time_purchases:
        m_idx = int(p.get("month", 1))
        amt = Decimal(str(p.get("amount", 0)))
        one_time_by_month[m_idx] = one_time_by_month.get(m_idx, Decimal("0.00")) + amt

    monthly_inv_rate = (annual_investment_return_rate / Decimal("100.00")) / Decimal("12.00") if annual_investment_return_rate > 0 else Decimal("0.00")

    timeline = []
    curr_expected = starting_balance
    curr_best = starting_balance
    curr_adverse = starting_balance

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    today = date.today()
    start_month = today.month

    for i in range(1, months + 1):
        m_name = f"{month_names[(start_month + i - 2) % 12]} {(today.year + (start_month + i - 2) // 12)}"
        one_time = one_time_by_month.get(i, Decimal("0.00"))
        
        # Expected
        exp_inc = monthly_income
        exp_out = monthly_expenses + unexpected_expense_buffer + one_time + monthly_savings_contribution
        net_exp = exp_inc - exp_out
        curr_expected = (curr_expected * (Decimal("1.00") + monthly_inv_rate)) + net_exp

        # Best Case: +10% income, -5% base expenses
        best_inc = (monthly_income * Decimal("1.10")).quantize(Decimal("0.01"))
        best_out = (monthly_expenses * Decimal("0.95")) + one_time + monthly_savings_contribution
        net_best = best_inc - best_out
        curr_best = (curr_best * (Decimal("1.00") + monthly_inv_rate)) + net_best

        # Adverse Case: -10% income, +15% base expenses + extra buffer
        adv_inc = (monthly_income * Decimal("0.90")).quantize(Decimal("0.01"))
        adv_out = (monthly_expenses * Decimal("1.15")) + (unexpected_expense_buffer * Decimal("1.5")) + one_time + monthly_savings_contribution
        net_adv = adv_inc - adv_out
        curr_adverse = (curr_adverse * (Decimal("1.00") + monthly_inv_rate)) + net_adv

        timeline.append({
            "month_index": i,
            "month_name": m_name,
            "expected_income": exp_inc,
            "expected_expenses": exp_out,
            "net_cash_flow": net_exp.quantize(Decimal("0.01")),
            "projected_balance": curr_expected.quantize(Decimal("0.01")),
            "best_case_balance": curr_best.quantize(Decimal("0.01")),
            "adverse_case_balance": curr_adverse.quantize(Decimal("0.01"))
        })

    assumptions = [
        f"Baseline monthly income of ₹{monthly_income:,.2f} with recurring expenses of ₹{monthly_expenses:,.2f}.",
        f"Unexpected expense buffer of ₹{unexpected_expense_buffer:,.2f} applied per month.",
        "Best case assumes +10% income growth and 5% reduction in recurring costs.",
        "Adverse case stresses cash flow with -10% income and +15% increase in living costs.",
        "Deterministic model: forecasts are scenario projections, not guaranteed returns."
    ]

    warnings = []
    if curr_adverse < Decimal("0.00"):
        warnings.append("Adverse scenario results in negative cash balance. Recommend maintaining a larger emergency reserve.")
    if monthly_expenses > monthly_income:
        warnings.append("Current recurring expenses exceed monthly income, causing ongoing cash flow deficit.")

    return {
        "months": months,
        "starting_balance": starting_balance,
        "ending_balance_expected": curr_expected.quantize(Decimal("0.01")),
        "ending_balance_best": curr_best.quantize(Decimal("0.01")),
        "ending_balance_adverse": curr_adverse.quantize(Decimal("0.01")),
        "timeline": timeline,
        "assumptions": assumptions,
        "warnings": warnings
    }
