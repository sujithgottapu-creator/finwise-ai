import os
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.models import (
    User, FinancialProfile, Account, Category, Transaction,
    Budget, SavingsGoal, GoalContribution, RecurringBill, Debt,
    AgentRun, Recommendation, AuditEvent
)
from app.core.security import get_password_hash

def seed_demo_data(db: Session) -> User:
    """Creates a complete demonstration account and administrative account with sample fintech data."""
    # Check if demo user already exists
    demo_user = db.query(User).filter(User.email == "demo@finwise.ai").first()
    if demo_user:
        return demo_user

    # Create Demo User
    demo_user = User(
        email="demo@finwise.ai",
        password_hash=get_password_hash("Demo1234!"),
        display_name="John Smith",
        currency="INR",
        role="user",
        is_active=True
    )
    db.add(demo_user)
    db.flush()

    # Create Admin User only when a private password is supplied through the environment.
    # There is deliberately no built-in default admin password.
    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@finwise.ai").lower()
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user and admin_password and admin_password != "Admin1234!":
        admin_user = User(
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            display_name="Security Admin",
            currency="INR",
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        db.flush()

    # 1. Financial Profile
    profile = FinancialProfile(
        user_id=demo_user.id,
        monthly_income=Decimal("60500.00"),
        income_frequency="monthly",
        essential_expenses=Decimal("20450.00"),
        discretionary_expenses=Decimal("12000.00"),
        current_savings=Decimal("57700.00"),
        total_debt=Decimal("25000.00"),
        timezone="Asia/Kolkata",
        age_range="25-34",
        is_onboarded=True
    )
    db.add(profile)

    # 2. Accounts
    bank_acc = Account(
        user_id=demo_user.id,
        account_name="HDFC Primary Salary Account",
        account_type="bank",
        opening_balance=Decimal("45000.00"),
        current_balance=Decimal("78400.00")
    )
    wallet_acc = Account(
        user_id=demo_user.id,
        account_name="UPI / Digital Wallet",
        account_type="wallet",
        opening_balance=Decimal("2000.00"),
        current_balance=Decimal("3500.00")
    )
    db.add_all([bank_acc, wallet_acc])
    db.flush()

    # 3. Standard Categories
    categories_data = [
        ("Salary", "income", "briefcase", "#16A36A"),
        ("Freelance", "income", "sparkles", "#10B981"),
        ("Housing", "expense", "home", "#16845d"),
        ("Food & Groceries", "expense", "shopping-bag", "#4c83df"),
        ("Transport", "expense", "car", "#e4a64c"),
        ("Lifestyle", "expense", "coffee", "#9b79d7"),
        ("Subscriptions", "expense", "tv", "#6366f1"),
        ("Healthcare", "expense", "heart-pulse", "#ef4444"),
        ("Utilities", "expense", "zap", "#f59e0b"),
        ("Other", "expense", "circle", "#b9c7bf"),
    ]
    
    cat_map = {}
    for name, t_type, icon, color in categories_data:
        cat = Category(
            user_id=demo_user.id,
            name=name,
            transaction_type=t_type,
            icon=icon,
            color=color
        )
        db.add(cat)
        db.flush()
        cat_map[name] = cat

    # 4. Transactions for current month (Oct 2026) and previous
    today = date.today()
    cur_year = today.year
    cur_month = today.month

    tx_samples = [
        # Income
        (Decimal("52000.00"), "income", date(cur_year, cur_month, 1), "Monthly Salary Credit", "Salary", bank_acc.id),
        (Decimal("8500.00"), "income", date(cur_year, cur_month, 8), "Freelance UI Consulting", "Freelance", bank_acc.id),
        # Expenses (Total: ~15,879)
        (Decimal("12000.00"), "expense", date(cur_year, cur_month, 2), "Monthly Apartment Rent", "Housing", bank_acc.id),
        (Decimal("2450.00"), "expense", date(cur_year, cur_month, 5), "Weekly Organic Groceries", "Food & Groceries", wallet_acc.id),
        (Decimal("780.00"), "expense", date(cur_year, cur_month, 7), "Metro Pass & Cab Rides", "Transport", wallet_acc.id),
        (Decimal("649.00"), "expense", date(cur_year, cur_month, 9), "Netflix Premium Subscription", "Subscriptions", bank_acc.id),
    ]

    for amt, t_type, dt, desc, cat_name, acc_id in tx_samples:
        tx = Transaction(
            user_id=demo_user.id,
            account_id=acc_id,
            category_id=cat_map[cat_name].id if cat_name in cat_map else None,
            amount=amt,
            currency="INR",
            transaction_type=t_type,
            transaction_date=dt,
            description=desc,
            notes="Illustrative sample transaction"
        )
        db.add(tx)

    # 5. Budgets for current month
    month_start = date(cur_year, cur_month, 1)
    # End of month
    if cur_month == 12:
        month_end = date(cur_year, 12, 31)
    else:
        month_end = date(cur_year, cur_month + 1, 1) - timedelta(days=1)

    budgets_data = [
        ("Housing", Decimal("15000.00")),
        ("Food & Groceries", Decimal("9000.00")),
        ("Transport", Decimal("4000.00")),
        ("Lifestyle", Decimal("5000.00")),
    ]
    for b_name, b_limit in budgets_data:
        if b_name in cat_map:
            b = Budget(
                user_id=demo_user.id,
                category_id=cat_map[b_name].id,
                period_start=month_start,
                period_end=month_end,
                limit_amount=b_limit,
                warning_threshold=Decimal("80.00")
            )
            db.add(b)

    # 6. Savings Goals
    goal1 = SavingsGoal(
        user_id=demo_user.id,
        name="Emergency fund",
        target_amount=Decimal("50000.00"),
        current_saved_amount=Decimal("32000.00"),
        currency="INR",
        target_date=date(cur_year, 12, 31),
        priority="high",
        status="active"
    )
    goal2 = SavingsGoal(
        user_id=demo_user.id,
        name="New laptop",
        target_amount=Decimal("35000.00"),
        current_saved_amount=Decimal("18500.00"),
        currency="INR",
        target_date=date(cur_year + 1, 3, 31),
        priority="medium",
        status="active"
    )
    goal3 = SavingsGoal(
        user_id=demo_user.id,
        name="Goa trip",
        target_amount=Decimal("12000.00"),
        current_saved_amount=Decimal("7200.00"),
        currency="INR",
        target_date=date(cur_year, 11, 30),
        priority="low",
        status="active"
    )
    db.add_all([goal1, goal2, goal3])
    db.flush()

    # Add sample contributions
    c1 = GoalContribution(
        goal_id=goal1.id,
        user_id=demo_user.id,
        amount=Decimal("5000.00"),
        contribution_date=date(cur_year, cur_month, 2),
        notes="Monthly automated savings transfer"
    )
    c2 = GoalContribution(
        goal_id=goal2.id,
        user_id=demo_user.id,
        amount=Decimal("3500.00"),
        contribution_date=date(cur_year, cur_month, 4),
        notes="Bonus allocation"
    )
    db.add_all([c1, c2])

    # 7. Recurring Bills
    bills_data = [
        ("Apartment Rent", Decimal("12000.00"), "monthly", date(cur_year, cur_month, 15), "Housing", "upcoming"),
        ("Netflix Subscription", Decimal("649.00"), "monthly", date(cur_year, cur_month, 20), "Subscriptions", "upcoming"),
        ("Airtel Broadband", Decimal("999.00"), "monthly", date(cur_year, cur_month, 25), "Utilities", "upcoming"),
        ("Electricity Bill", Decimal("2100.00"), "monthly", date(cur_year, cur_month, 28), "Utilities", "upcoming"),
    ]
    for b_name, b_amt, b_freq, b_due, b_cat, b_status in bills_data:
        cat_id = cat_map[b_cat].id if b_cat in cat_map else None
        rb = RecurringBill(
            user_id=demo_user.id,
            category_id=cat_id,
            name=b_name,
            amount=b_amt,
            currency="INR",
            frequency=b_freq,
            next_due_date=b_due,
            status=b_status,
            notes="Sample recurring payment commitment"
        )
        db.add(rb)

    # 8. Debts
    debts_data = [
        ("Student Computer Loan", Decimal("18000.00"), Decimal("11.500"), Decimal("2200.00"), date(cur_year + 1, 6, 30)),
        ("Credit Card EMI", Decimal("7000.00"), Decimal("24.000"), Decimal("1500.00"), date(cur_year, 12, 31)),
    ]
    for d_name, d_bal, d_apr, d_min, d_payoff in debts_data:
        debt = Debt(
            user_id=demo_user.id,
            name=d_name,
            outstanding_balance=d_bal,
            interest_rate=d_apr,
            minimum_payment=d_min,
            payment_frequency="monthly",
            target_payoff_date=d_payoff
        )
        db.add(debt)

    # 9. Initial Agent Run & Recommendation
    run = AgentRun(
        user_id=demo_user.id,
        workflow_type="monthly_financial_health_audit",
        status="completed",
        prompt="Initial workspace setup automated health check",
        logs='[{"agent": "Expense Analyst", "action": "Calculated category totals", "output_summary": "Housing takes 75% of current expenses"}, {"agent": "Budget Planner", "action": "Assessed monthly limits", "output_summary": "Food and Groceries at 71% of limit"}, {"agent": "Savings Planner", "action": "Checked emergency fund target", "output_summary": "Need ₹6,000/mo to hit Dec 31 goal"}, {"agent": "Validation Layer", "action": "Validated monetary numbers", "output_summary": "All figures match database ledgers"}]',
        execution_time_ms=280
    )
    db.add(run)
    db.flush()

    rec = Recommendation(
        user_id=demo_user.id,
        agent_run_id=run.id,
        recommendation_type="savings_allocation",
        title="Accelerate Emergency Reserve Contribution",
        explanation="With positive net cash flow of ₹44,621 this month, you can safely allocate ₹6,000 toward your Emergency Fund to reach your ₹50,000 target by December 31 without impacting upcoming bill commitments.",
        supporting_figures='{"current_saved": 32000, "target": 50000, "months_left": 2, "suggested_monthly_boost": 6000}',
        suggested_action="Transfer ₹6,000 to Emergency Fund goal",
        status="pending"
    )
    db.add(rec)

    # 10. Audit Event
    audit = AuditEvent(
        user_id=demo_user.id,
        action="WORKSPACE_INITIALIZED",
        entity_type="user",
        entity_id=str(demo_user.id),
        details='{"note": "Demonstration account seeded with realistic illustrative records"}'
    )
    db.add(audit)

    db.commit()
    return demo_user
