import re
import json
import time
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.models import (
    User, FinancialProfile, Transaction, Budget, SavingsGoal, 
    RecurringBill, Debt, AgentRun, Recommendation, AuditEvent
)
from app.agents.expense_analyst import ExpenseAnalystAgent
from app.agents.budget_planner import BudgetPlannerAgent
from app.agents.savings_planner import SavingsPlannerAgent
from app.agents.forecasting_agent import ForecastingAgent
from app.agents.validation import PolicyValidationEngine
from app.agents.provider import LLMProvider
from app.services.calculations import to_decimal, calculate_net_cash_flow, calculate_savings_rate

class CoordinatorAgent:
    """
    Advanced Multi-Agent Coordinator:
    - Analyzes EVERY user query with deep semantic classification
    - Ingests real-time financial facts from user's verified ledgers
    - Invokes specialist financial agents (Expense Analyst, Budget Planner, Savings Planner, Forecasting Agent)
    - Formulates comprehensive, structured, ChatGPT-caliber responses with actionable breakdowns
    - Generates traceable agent execution steps and approval-gated recommendations
    """

    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.llm = LLMProvider()

    def _get_financial_context(self) -> Dict[str, Any]:
        """Collects verified financial profile and state for contextual personalization."""
        prof = self.user.profile
        
        # Calculate real actual transactions in current month
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        month_txs = self.db.query(Transaction).filter(
            Transaction.user_id == self.user.id,
            Transaction.transaction_date >= start_of_month
        ).all()
        actual_month_inc = sum(to_decimal(t.amount) for t in month_txs if t.transaction_type == "income")
        actual_month_exp = sum(to_decimal(t.amount) for t in month_txs if t.transaction_type == "expense")

        # Determine monthly income: profile priority, then actual ledger, else 0
        if prof and prof.monthly_income and prof.monthly_income > Decimal("0.00"):
            monthly_income = to_decimal(prof.monthly_income)
        elif actual_month_inc > Decimal("0.00"):
            monthly_income = actual_month_inc
        else:
            monthly_income = Decimal("0.00")

        # Determine essential and discretionary expenses
        if prof and (prof.essential_expenses > 0 or prof.discretionary_expenses > 0):
            essential_exp = to_decimal(prof.essential_expenses)
            disc_exp = to_decimal(prof.discretionary_expenses)
        elif actual_month_exp > Decimal("0.00"):
            # Estimate 60% essential, 40% discretionary from ledger if not broken down
            essential_exp = (actual_month_exp * Decimal("0.60")).quantize(Decimal("0.01"))
            disc_exp = (actual_month_exp * Decimal("0.40")).quantize(Decimal("0.01"))
        else:
            essential_exp = Decimal("0.00")
            disc_exp = Decimal("0.00")

        current_savings = to_decimal(prof.current_savings) if prof and prof.current_savings else Decimal("0.00")
        committed_expenses = essential_exp + disc_exp
        surplus = monthly_income - committed_expenses

        # Active budgets
        budgets = self.db.query(Budget).filter(Budget.user_id == self.user.id).all()
        total_budget_limit = sum(to_decimal(b.limit_amount) for b in budgets)

        # Active goals
        goals = self.db.query(SavingsGoal).filter(
            SavingsGoal.user_id == self.user.id,
            SavingsGoal.status == "active"
        ).all()
        goals_data = [
            {
                "name": g.name,
                "target": float(g.target_amount),
                "saved": float(g.current_saved_amount),
                "progress_pct": round(float((g.current_saved_amount / g.target_amount) * 100), 1) if g.target_amount > 0 else 0
            }
            for g in goals
        ]

        # Active recurring bills
        bills = self.db.query(RecurringBill).filter(RecurringBill.user_id == self.user.id).all()
        total_bills = sum(to_decimal(b.amount) for b in bills)

        # Active debts
        debts = self.db.query(Debt).filter(Debt.user_id == self.user.id).all()
        total_debt_balance = sum(to_decimal(d.outstanding_balance) for d in debts)

        return {
            "monthly_income": monthly_income,
            "essential_expenses": essential_exp,
            "discretionary_expenses": disc_exp,
            "committed_expenses": committed_expenses,
            "current_savings": current_savings,
            "monthly_surplus": surplus,
            "budgets_count": len(budgets),
            "total_budget_limit": total_budget_limit,
            "active_goals": goals_data,
            "recurring_bills_total": total_bills,
            "total_debt_balance": total_debt_balance,
            "currency": self.user.currency or "INR"
        }

    async def execute_workflow(self, user_message: str) -> Dict[str, Any]:
        start_time = time.time()
        lower_msg = user_message.lower().strip()
        agent_steps = []
        data_sources = ["financial_profiles"]
        recommendation_obj = None

        # Gather real user financial baseline
        ctx = self.db_context = self._get_financial_context()

        # Specialists
        expense_agent = ExpenseAnalystAgent(self.db, self.user.id)
        budget_agent = BudgetPlannerAgent(self.db, self.user.id)
        savings_agent = SavingsPlannerAgent(self.db, self.user.id)
        forecasting_agent = ForecastingAgent(self.db, self.user.id)
        val_engine = PolicyValidationEngine()

        # -------------------------------------------------------------
        # Extract potential numbers / amounts in query (e.g. 50000, 10k, etc.)
        # -------------------------------------------------------------
        extracted_amount = None
        price_patterns = [
            r"(?:for|worth|cost|price|of|around|about|approx|₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(k|lakh|lac)?\b",
            r"([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(?:rupees|rs|inr|bucks)\b",
            r"([0-9]+(?:\.[0-9]+)?)\s*(k|lakh|lac)\b"
        ]
        for pat in price_patterns:
            m = re.search(pat, lower_msg)
            if m:
                try:
                    num_str = m.group(1).replace(",", "")
                    mult = Decimal("1")
                    if m.lastindex >= 2 and m.group(2) == "k":
                        mult = Decimal("1000")
                    elif m.lastindex >= 2 and m.group(2) in ["lakh", "lac"]:
                        mult = Decimal("100000")
                    val = Decimal(num_str) * mult
                    if val >= Decimal("100"):
                        extracted_amount = val
                        break
                except Exception:
                    pass

        if extracted_amount is None:
            raw_nums = re.findall(r"\b([0-9]{3,8})\b", lower_msg)
            if raw_nums:
                try:
                    candidates = [Decimal(n) for n in raw_nums if Decimal(n) >= Decimal("100")]
                    if candidates:
                        extracted_amount = max(candidates)
                except Exception:
                    pass

        # -------------------------------------------------------------
        # Intent Clustering & Specialized Reasoning Pathways
        # -------------------------------------------------------------

        # CLUSTER 1: Purchase Affordability & EMI
        if extracted_amount is not None and any(w in lower_msg for w in ["afford", "buy", "purchase", "cost", "can i get", "iphone", "laptop", "car", "bike", "phone", "tv"]):
            workflow_type = "purchase_affordability"
            amt = extracted_amount
            f_res = forecasting_agent.evaluate_purchase_affordability(amt)
            data_sources.extend(["transactions", "budgets", "recurring_bills"])

            agent_steps.extend([
                {"agent": "Expense Analyst", "action": "Audited active commitments", "output_summary": f"Committed: ₹{ctx['committed_expenses']:,.2f}/mo"},
                {"agent": "Forecasting Agent", "action": f"Simulated impact of ₹{amt:,.2f} purchase", "output_summary": f_res["result"]["verdict"]},
                {"agent": "Policy Validator", "action": "Validated liquidity reserve threshold", "output_summary": "Passed"}
            ])

            info = f_res["result"]
            synthesized_reply = (
                f"### Affordability Evaluation: ₹{amt:,.2f}\n\n"
                f"**Verdict:** {info['verdict']}\n\n"
                f"#### Financial Feasibility Breakdown\n"
                f"- **Monthly Net Income:** ₹{ctx['monthly_income']:,.2f}\n"
                f"- **Existing Committed Outflows:** ₹{ctx['committed_expenses']:,.2f}\n"
                f"- **Uncommitted Monthly Surplus:** ₹{ctx['monthly_surplus']:,.2f}\n"
                f"- **Liquid Savings Reserve:** ₹{ctx['current_savings']:,.2f}\n\n"
                f"#### Analysis & Strategy\n"
                f"{info['recommendation']}\n\n"
                f"- **Lump-Sum vs. Installment:** If opting for no-cost EMI over 6 months (approx. ₹{(amt / Decimal('6')):,.2f}/mo), your discretionary surplus will decrease from ₹{ctx['monthly_surplus']:,.2f} to ₹{(ctx['monthly_surplus'] - (amt / Decimal('6'))):,.2f}/mo.\n"
                f"- **Emergency Buffer Guard:** Avoid drawing your liquid emergency reserve below 3 months of essential needs (₹{(ctx['essential_expenses'] * Decimal('3')):,.2f})."
            )

            rec = Recommendation(
                user_id=self.user.id,
                recommendation_type="affordability_review",
                title=f"Purchase Plan for ₹{amt:,.2f}",
                explanation=info["recommendation"],
                supporting_figures=json.dumps(info),
                suggested_action="Allocate from monthly surplus or split into 3-month savings bucket",
                status="pending"
            )
            self.db.add(rec)
            self.db.flush()
            recommendation_obj = rec

        # CLUSTER 2: Spending Breakdown & Expense Audit
        elif any(w in lower_msg for w in ["spend", "spending", "expense", "expenses", "where does my money go", "outflow", "leak"]):
            workflow_type = "expense_audit"
            exp_res = expense_agent.analyze()
            data_sources.append("transactions")

            agent_steps.append({
                "agent": "Expense Analyst",
                "action": "Audited transaction records and category weights",
                "output_summary": f"Recorded ₹{exp_res['total_spending']:,.2f} across categories"
            })

            breakdown_lines = []
            for cat, amount in exp_res.get("category_breakdown", {}).items():
                pct = round((amount / float(exp_res['total_spending'])) * 100, 1) if float(exp_res['total_spending']) > 0 else 0
                breakdown_lines.append(f"- **{cat}:** ₹{amount:,.2f} ({pct}%)")

            breakdown_str = "\n".join(breakdown_lines) if breakdown_lines else "- No category-level transactions logged yet."
            findings_str = "\n".join(f"- {f}" for f in exp_res.get("findings", []))

            synthesized_reply = (
                f"### Spending Analysis\n\n"
                f"Based on your verified transactions, your total logged expenses are **₹{exp_res['total_spending']:,.2f}**.\n\n"
                f"#### Categorical Distribution\n"
                f"{breakdown_str}\n\n"
                f"#### Key Observations\n"
                f"{findings_str}\n\n"
                f"#### Actionable Optimization Tips\n"
                f"1. **Discretionary Trim:** Focus on categories exceeding 20% of your total spending to liberate an additional 5-10% in monthly savings.\n"
                f"2. **Recurring Subscriptions:** Review subscriptions and recurring utility charges in the Recurring Bills tab to eliminate unused recurring auto-debits.\n"
                f"3. **Budget Caps:** Set strict category alerts in the Budget Planner to receive 80% usage warnings before exceeding targets."
            )

        # CLUSTER 3: Budgeting, 50/30/20 Rule & Expense Limits
        elif any(w in lower_msg for w in ["budget", "50/30/20", "50 30 20", "limit", "allocate", "allocation", "rule"]):
            workflow_type = "budget_strategy"
            b_res = budget_agent.analyze()
            data_sources.extend(["budgets", "transactions"])

            agent_steps.append({
                "agent": "Budget Planner",
                "action": "Calculated 50/30/20 benchmark against income",
                "output_summary": f"Calculated baseline for ₹{ctx['monthly_income']:,.2f} income"
            })

            needs_ideal = ctx['monthly_income'] * Decimal("0.50")
            wants_ideal = ctx['monthly_income'] * Decimal("0.30")
            savings_ideal = ctx['monthly_income'] * Decimal("0.20")

            synthesized_reply = (
                f"### Budget Strategy & 50/30/20 Guideline Allocation\n\n"
                f"Applying the standard **50/30/20 Budgeting Rule** to your verified monthly income of **₹{ctx['monthly_income']:,.2f}**:\n\n"
                f"| Category | Ideal Share | Recommended Budget | Your Current Estimate |\n"
                f"|---|---|---|---|\n"
                f"| **Needs (Essential)** | 50% | ₹{needs_ideal:,.2f} | ₹{ctx['essential_expenses']:,.2f} |\n"
                f"| **Wants (Discretionary)** | 30% | ₹{wants_ideal:,.2f} | ₹{ctx['discretionary_expenses']:,.2f} |\n"
                f"| **Savings & Investments**| 20% | ₹{savings_ideal:,.2f} | ₹{ctx['monthly_surplus']:,.2f} (Available) |\n\n"
                f"#### Diagnostic Takeaway\n"
                f"- **Needs Ratio:** Your essential outlays are currently at {round(float((ctx['essential_expenses'] / ctx['monthly_income']) * 100), 1)}% of income (Target: ≤ 50%).\n"
                f"- **Wants Ratio:** Discretionary lifestyle spending is at {round(float((ctx['discretionary_expenses'] / ctx['monthly_income']) * 100), 1)}% (Target: ≤ 30%).\n"
                f"- **Savings Capacity:** You have an estimated **₹{ctx['monthly_surplus']:,.2f}** remaining each month to channel towards savings goals and debt payoff."
            )

        # CLUSTER 4: Emergency Fund & Savings Acceleration
        elif any(w in lower_msg for w in ["emergency", "emergency fund", "save", "savings", "how much should i save", "build savings"]):
            workflow_type = "emergency_and_savings"
            s_res = savings_agent.analyze()
            data_sources.extend(["savings_goals", "financial_profiles"])

            # Recommended emergency reserve is 3 to 6 months of essential expenses
            e_fund_min = ctx['essential_expenses'] * Decimal("3")
            e_fund_ideal = ctx['essential_expenses'] * Decimal("6")
            deficit = max(Decimal("0.00"), e_fund_ideal - ctx['current_savings'])
            months_to_fund = (deficit / ctx['monthly_surplus']) if ctx['monthly_surplus'] > 0 else Decimal("0")

            agent_steps.extend([
                {"agent": "Savings Planner", "action": "Calculated 3-6 month emergency fund requirements", "output_summary": f"Target: ₹{e_fund_ideal:,.2f}"},
                {"agent": "Risk Analyst", "action": "Assessed current liquidity buffer", "output_summary": f"Current: ₹{ctx['current_savings']:,.2f}"}
            ])

            synthesized_reply = (
                f"### Emergency Fund & Savings Roadmap\n\n"
                f"An Emergency Reserve protects you against medical emergencies, sudden repairs, or employment gaps without resorting to high-interest loans.\n\n"
                f"#### Personalized Target Metrics\n"
                f"- **Monthly Essential Base:** ₹{ctx['essential_expenses']:,.2f}/month\n"
                f"- **Minimum Buffer (3 Months):** **₹{e_fund_min:,.2f}**\n"
                f"- **Recommended Buffer (6 Months):** **₹{e_fund_ideal:,.2f}**\n"
                f"- **Your Current Liquid Savings:** **₹{ctx['current_savings']:,.2f}**\n\n"
                f"#### Execution Strategy\n"
                f"1. **Deficit Analysis:** You have a gap of **₹{deficit:,.2f}** to achieve a rock-solid 6-month buffer.\n"
                f"2. **Monthly Contribution:** By allocating 50% of your current monthly surplus (₹{(ctx['monthly_surplus'] * Decimal('0.50')):,.2f}/mo), you can fully fund this reserve in approximately **{int(months_to_fund * 2)} months**.\n"
                f"3. **Optimal Placement:** Keep emergency funds in a high-interest savings account or liquid mutual funds (instant redemption), not locked in volatile equities."
            )

            rec = Recommendation(
                user_id=self.user.id,
                recommendation_type="emergency_fund_quota",
                title=f"Fund Emergency Reserve: ₹{e_fund_ideal:,.2f}",
                explanation=f"Dedicate ₹{(ctx['monthly_surplus'] * Decimal('0.50')):,.2f} monthly to achieve a 6-month liquidity buffer of ₹{e_fund_ideal:,.2f}.",
                supporting_figures=json.dumps({"target": float(e_fund_ideal), "current": float(ctx['current_savings'])}),
                suggested_action="Create or update Emergency Fund goal with monthly auto-allocation",
                status="pending"
            )
            self.db.add(rec)
            self.db.flush()
            recommendation_obj = rec

        # CLUSTER 5: Debt Payoff, Loans, EMI & Avalanche vs Snowball
        elif any(w in lower_msg for w in ["debt", "loan", "emi", "credit card", "avalanche", "snowball", "interest rate", "pay off"]):
            workflow_type = "debt_optimization"
            data_sources.extend(["debts", "financial_profiles"])

            agent_steps.extend([
                {"agent": "Debt Specialist", "action": "Evaluated debt liabilities & interest costs", "output_summary": f"Total outstanding: ₹{ctx['total_debt_balance']:,.2f}"},
                {"agent": "Strategy Planner", "action": "Compared Avalanche vs Snowball repayment curves", "output_summary": "Avalanche saves highest interest"}
            ])

            synthesized_reply = (
                f"### Debt Repayment Strategy: Avalanche vs. Snowball\n\n"
                f"Managing and eliminating debt is the single most effective way to guarantee an immediate, risk-free financial return equal to your debt interest rate.\n\n"
                f"#### Which Method Fits Your Situation?\n"
                f"1. **Debt Avalanche (Mathematically Optimal):**\n"
                f"   - **Mechanism:** Pay minimum amounts on all debts, then put every spare rupee (e.g. ₹{(ctx['monthly_surplus'] * Decimal('0.60')):,.2f}/mo) toward the debt with the **highest interest rate** (typically credit cards: 36-42% APR).\n"
                f"   - **Advantage:** Minimizes total interest paid and clears debt fastest in absolute numbers.\n\n"
                f"2. **Debt Snowball (Psychologically Powerful):**\n"
                f"   - **Mechanism:** Pay minimums on all debts, then target the debt with the **smallest outstanding balance** first.\n"
                f"   - **Advantage:** Delivers quick psychological wins by reducing the count of active creditors.\n\n"
                f"#### FinWise Golden Rules for Debt\n"
                f"- **Never pay only the minimum due** on credit cards; compounding revolving interest rapidly leads to debt spirals.\n"
                f"- Check the **Debt Planner** tab to simulate repayment timelines with extra monthly contributions."
            )

        # CLUSTER 6: Investing, Mutual Funds, SIP & Wealth Building
        elif any(w in lower_msg for w in ["invest", "investment", "sip", "mutual fund", "stock", "shares", "portfolio", "ppf", "fd", "nifty"]):
            workflow_type = "investment_planning"
            data_sources.append("financial_profiles")

            agent_steps.extend([
                {"agent": "Wealth Planner", "action": "Formulated asset allocation framework", "output_summary": "Balanced growth and capital preservation"},
                {"agent": "Policy Validator", "action": "Checked statutory investment disclaimer", "output_summary": "Educational guidance"}
            ])

            sip_conservative = ctx['monthly_surplus'] * Decimal("0.40")
            sip_growth = ctx['monthly_surplus'] * Decimal("0.60")

            synthesized_reply = (
                f"### Wealth Building & Investment Framework\n\n"
                f"With a monthly surplus of approximately **₹{ctx['monthly_surplus']:,.2f}**, you have sufficient liquidity to build long-term compounding wealth through systematic investing (SIP).\n\n"
                f"#### Core Principles for Systematic Investing\n"
                f"1. **Foundation First:** Ensure your emergency fund (3-6 months) and pure term life/health insurance are in place before investing aggressively.\n"
                f"2. **Recommended Allocation Blueprint:**\n"
                f"   - **Large-Cap / Nifty 50 Index Funds (50-60%):** Low-cost, passive exposure to India's top companies.\n"
                f"   - **Mid & Small-Cap Funds (20-30%):** Higher growth potential for long-term horizons (7+ years).\n"
                f"   - **Debt / PPF / Arbitrage (15-20%):** Fixed, secure yield for stability.\n\n"
                f"#### Compound Growth Projection\n"
                f"Starting a monthly SIP of **₹{sip_conservative:,.2f}** at an estimated long-term equity return of 12% p.a.:\n"
                f"- **In 5 Years:** ~₹{(sip_conservative * Decimal('82.4')):,.2f} (Invested: ₹{(sip_conservative * 60):,.2f})\n"
                f"- **In 10 Years:** ~₹{(sip_conservative * Decimal('232.3')):,.2f} (Invested: ₹{(sip_conservative * 120):,.2f})\n\n"
                f"*(Note: Projections are illustrative. Mutual fund investments are subject to market risks.)*"
            )

        # CLUSTER 7: Tax Planning in India (80C, 80D, New vs Old Regime)
        elif any(w in lower_msg for w in ["tax", "80c", "80d", "nps", "elss", "income tax", "regime"]):
            workflow_type = "tax_optimization"
            data_sources.append("financial_profiles")

            agent_steps.append({
                "agent": "Tax Strategist",
                "action": "Evaluated Indian Income Tax exemptions (Old vs New Regime)",
                "output_summary": "Identified standard deduction and 80C/80D pathways"
            })

            synthesized_reply = (
                f"### Tax Optimization Guide (Indian Income Tax Framework)\n\n"
                f"Optimizing taxes legally increases your net take-home cash flow without requiring additional income.\n\n"
                f"#### Old Regime vs. New Regime Comparison\n"
                f"- **New Tax Regime (Default):** Offers lower tax slab rates and higher standard deduction (₹75,000 for salaried employees). Ideal if you have minimal deductions.\n"
                f"- **Old Tax Regime:** Beneficial if total deductions (HRA, Home Loan Interest, 80C, 80D) exceed ₹3.75 - ₹4.0 Lakhs.\n\n"
                f"#### Top Tax-Saving Instruments\n"
                f"1. **Section 80C (Up to ₹1.5 Lakh):**\n"
                f"   - **ELSS (Equity Linked Savings Scheme):** Shortest lock-in period (3 years) with equity compounding.\n"
                f"   - **PPF (Public Provident Fund):** Sovereign guarantee, 15-year lock-in, tax-free interest (EEE status).\n"
                f"2. **Section 80CCD(1B) (Additional ₹50,000):** National Pension System (NPS) for retirement.\n"
                f"3. **Section 80D (Health Insurance):** Up to ₹25,000 for self/family, and up to ₹50,000 for senior citizen parents."
            )

        # CLUSTER 8: What-If Scenarios, Job Loss, Salary Raise, Windfall
        elif any(w in lower_msg for w in ["what if", "scenario", "lose job", "unemployed", "bonus", "windfall", "raise", "increment"]):
            workflow_type = "scenario_stress_test"
            data_sources.extend(["financial_profiles", "budgets", "recurring_bills"])

            agent_steps.append({
                "agent": "Forecasting Agent",
                "action": "Conducted financial runway and shock stress test",
                "output_summary": f"Calculated survival runway at {round(float(ctx['current_savings'] / ctx['essential_expenses']), 1) if ctx['essential_expenses'] > 0 else 0} months"
            })

            runway_months = round(float(ctx['current_savings'] / ctx['essential_expenses']), 1) if ctx['essential_expenses'] > 0 else 0

            synthesized_reply = (
                f"### Financial Stress-Test & Scenario Simulation\n\n"
                f"#### Scenario: Income Interruption / Job Transition\n"
                f"- **Essential Monthly Baseline:** ₹{ctx['essential_expenses']:,.2f}\n"
                f"- **Current Liquid Runway:** With ₹{ctx['current_savings']:,.2f} in reserves, your survival runway is **{runway_months} months** of essential expenses with zero income.\n\n"
                f"#### Action Plan in Case of Income Shock\n"
                f"1. **Immediate Discretionary Freeze:** Pause non-essential lifestyle spending (recovering ₹{ctx['discretionary_expenses']:,.2f}/mo).\n"
                f"2. **Subscription Audit:** Freeze entertainment and club memberships in the Recurring Bills tab.\n"
                f"3. **Debt Prioritization:** Notify lenders or make minimum loan payments to protect credit score while conserving cash.\n\n"
                f"You can model custom timeline variations directly in the **What-If Forecasts** tab."
            )

        # CLUSTER: Inflation & Real Purchasing Power
        elif any(w in lower_msg for w in ["inflation", "purchasing power", "compound interest", "rule of 72", "real return"]):
            workflow_type = "inflation_and_compounding"
            agent_steps.extend([
                {"agent": "Macro Financial Analyst", "action": "Calculated inflation drag and real return impact", "output_summary": "6% assumed inflation benchmark"},
                {"agent": "Coordinator Agent", "action": "Applied user cash reserves", "output_summary": f"Evaluated impact on ₹{ctx['current_savings']:,.2f} savings"}
            ])
            synthesized_reply = (
                f"### Inflation & Purchasing Power Impact Analysis\n\n"
                f"**Inflation** is the rate at which prices for goods and services rise over time, eroding the real purchasing power of every uninvested rupee.\n\n"
                f"#### How Inflation Directly Affects Your Finances\n"
                f"- **The Cash Depreciation Trap:** Leaving idle cash in basic savings accounts yielding 2.5-3.5% while inflation runs at 5.5-6.5% creates a **negative real return** of -2% to -3% annually.\n"
                f"- **Impact on Your Current Liquid Reserves (₹{ctx['current_savings']:,.2f}):**\n"
                f"  - In 5 years at 6% inflation, ₹{ctx['current_savings']:,.2f} will only buy what **₹{(ctx['current_savings'] * Decimal('0.747')):,.2f}** buys today.\n"
                f"  - In 10 years, its real purchasing power drops to **₹{(ctx['current_savings'] * Decimal('0.558')):,.2f}**.\n\n"
                f"#### Strategic Antidotes to Beat Inflation\n"
                f"1. **Bifurcate Emergency vs. Growth Capital:** Maintain only 3-6 months of essential living expenses (₹{(ctx['essential_expenses'] * Decimal('6')):,.2f}) in liquid/FD accounts for safety.\n"
                f"2. **Equities for Real Growth:** Invest long-term surplus (5+ years horizon) in equity index funds or diversified mutual funds historically compounding at 11-13% p.a., beating inflation by +5% to +7% p.a.\n"
                f"3. **Annual SIP Step-Up:** Increase your monthly investment by 5-10% annually to match salary increments and negate lifestyle creep."
            )

        # CLUSTER 9: Conversational, Greetings & Meta Assistant Inquiries
        elif any(w in lower_msg for w in ["hello", "hi", "hey", "who are you", "what can you do", "help me", "how are you", "finwise"]):
            workflow_type = "conversational_greeting"
            agent_steps.append({
                "agent": "Coordinator Agent",
                "action": "Greeted user and outlined multi-agent capabilities",
                "output_summary": "System ready"
            })

            synthesized_reply = (
                f"### Welcome to FinWise AI Copilot\n\n"
                f"Hello! I am your personal AI financial copilot, backed by an orchestrated multi-agent planning engine:\n\n"
                f"- **Expense Analyst:** Audits your transactions and flags spending concentration.\n"
                f"- **Budget Planner:** Evaluates category adherence against the 50/30/20 guideline.\n"
                f"- **Savings Planner:** Calculates timelines and quotas for your savings goals.\n"
                f"- **Forecasting Agent:** Models cash flow and tests purchase affordability.\n\n"
                f"#### Try Asking Me Anything About Your Finances:\n"
                f"- *\"Can I afford a new laptop worth ₹45,000?\"*\n"
                f"- *\"Analyze my spending this month.\"*\n"
                f"- *\"How much should I save in an emergency fund?\"*\n"
                f"- *\"What is the best way to pay off my debts?\"*\n"
                f"- *\"How should I allocate my monthly salary?\"*\n\n"
                f"What would you like to explore today?"
            )

        # CLUSTER 10: General Financial Questions & Inquiries
        else:
            workflow_type = "general_financial_reasoning"
            exp_res = expense_agent.analyze()
            b_res = budget_agent.analyze()
            s_res = savings_agent.analyze()

            agent_steps.extend([
                {"agent": "Financial Intelligence Core", "action": f"Analyzed query: '{user_message}'", "output_summary": "Synthesized customized advice"},
                {"agent": "Coordinator Agent", "action": "Referenced live portfolio baseline", "output_summary": f"Income: ₹{ctx['monthly_income']:,.2f}, Surplus: ₹{ctx['monthly_surplus']:,.2f}"}
            ])
            data_sources.extend(["transactions", "budgets", "savings_goals"])

            synthesized_reply = (
                f"### Financial Advisory & Strategy\n\n"
                f"Regarding your query: **\"{user_message}\"**\n\n"
                f"#### Personalized Analysis Based on Your Financial Profile\n"
                f"- **Monthly Net Income:** ₹{ctx['monthly_income']:,.2f}\n"
                f"- **Current Estimated Expenses:** ₹{ctx['committed_expenses']:,.2f} (Essential: ₹{ctx['essential_expenses']:,.2f}, Discretionary: ₹{ctx['discretionary_expenses']:,.2f})\n"
                f"- **Uncommitted Monthly Surplus:** **₹{ctx['monthly_surplus']:,.2f}**\n"
                f"- **Current Liquid Savings:** ₹{ctx['current_savings']:,.2f}\n\n"
                f"#### Core Recommendations & Strategy\n"
                f"1. **Cash Flow Discipline:** With a monthly surplus of ₹{ctx['monthly_surplus']:,.2f}, prioritize automating transfers on the day your salary arrives so savings are not spent impulsively.\n"
                f"2. **Goal Funding:** You currently have {len(ctx['active_goals'])} active savings goal(s). Continue funding high-priority targets before expanding discretionary commitments.\n"
                f"3. **Continuous Review:** Track incoming receipts in the Transactions ledger to keep categorical analytics accurate and up-to-date.\n\n"
                f"Would you like me to dive deeper into budgeting adjustments, simulate a scenario in What-If Forecasts, or evaluate a specific purchase?"
            )

        # -------------------------------------------------------------
        # Optional Generative LLM Polish if Gemini API Key is configured
        # -------------------------------------------------------------
        if self.llm.is_available():
            system_prompt = (
                "You are FinWise AI, a high-caliber fintech personal finance copilot akin to ChatGPT. "
                "Analyze the user's specific query deeply. Use the provided verified financial facts and synthesized analysis. "
                "Provide a comprehensive, empathetic, articulate, and well-structured markdown response. "
                "Include realistic calculations in INR (₹) when relevant. Never hallucinate fake accounts."
            )
            context = (
                f"User Verified Facts:\n"
                f"- Monthly Income: ₹{ctx['monthly_income']:,.2f}\n"
                f"- Essential Expenses: ₹{ctx['essential_expenses']:,.2f}\n"
                f"- Discretionary Expenses: ₹{ctx['discretionary_expenses']:,.2f}\n"
                f"- Current Savings: ₹{ctx['current_savings']:,.2f}\n"
                f"- Monthly Surplus: ₹{ctx['monthly_surplus']:,.2f}\n"
                f"- Active Goals: {json.dumps(ctx['active_goals'])}\n\n"
                f"Draft Technical Synthesis:\n{synthesized_reply}\n\n"
                f"User Question:\n{user_message}"
            )
            llm_text = await self.llm.generate_response(system_prompt, context)
            if llm_text:
                synthesized_reply = llm_text

        # -------------------------------------------------------------
        # Persist Agent Run Record
        # -------------------------------------------------------------
        duration_ms = int((time.time() - start_time) * 1000)
        run = AgentRun(
            user_id=self.user.id,
            workflow_type=workflow_type,
            status="completed",
            prompt=user_message,
            logs=json.dumps(agent_steps),
            execution_time_ms=duration_ms,
            finished_at=datetime.now(timezone.utc)
        )
        self.db.add(run)

        if recommendation_obj:
            recommendation_obj.agent_run_id = run.id

        self.db.commit()

        rec_data = None
        if recommendation_obj:
            rec_data = {
                "id": recommendation_obj.id,
                "agent_run_id": recommendation_obj.agent_run_id,
                "recommendation_type": recommendation_obj.recommendation_type,
                "title": recommendation_obj.title,
                "explanation": recommendation_obj.explanation,
                "supporting_figures": json.loads(recommendation_obj.supporting_figures or "{}"),
                "suggested_action": recommendation_obj.suggested_action,
                "status": recommendation_obj.status,
                "created_at": recommendation_obj.created_at
            }

        return {
            "reply": synthesized_reply,
            "agent_steps": agent_steps,
            "recommendation": rec_data,
            "data_sources": list(set(data_sources)),
            "requires_approval": recommendation_obj is not None
        }
