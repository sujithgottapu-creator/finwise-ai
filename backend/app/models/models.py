from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Numeric, 
    ForeignKey, Text, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(254), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(120), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    role = Column(String(20), default="user", nullable=False)  # user, admin
    is_active = Column(Boolean, default=True, nullable=False)
    # Security columns (added by app.core.migrate_security for existing databases)
    email_verified = Column(Boolean, default=True, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    profile = relationship("FinancialProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("SavingsGoal", back_populates="user", cascade="all, delete-orphan")
    bills = relationship("RecurringBill", back_populates="user", cascade="all, delete-orphan")
    debts = relationship("Debt", back_populates="user", cascade="all, delete-orphan")
    forecasts = relationship("ForecastScenario", back_populates="user", cascade="all, delete-orphan")
    agent_runs = relationship("AgentRun", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="user", cascade="all, delete-orphan")


class FinancialProfile(Base):
    __tablename__ = "financial_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    monthly_income = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    income_frequency = Column(String(30), default="monthly", nullable=False)
    essential_expenses = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    discretionary_expenses = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    current_savings = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_debt = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    timezone = Column(String(64), default="Asia/Kolkata", nullable=False)
    age_range = Column(String(32), nullable=True)
    is_onboarded = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="profile")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_name = Column(String(120), nullable=False)
    account_type = Column(String(30), default="bank", nullable=False)  # cash, bank, wallet, other
    opening_balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    current_balance = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(80), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # income, expense
    icon = Column(String(40), default="circle", nullable=False)
    color = Column(String(20), default="#16A36A", nullable=False)

    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")

    __table_args__ = (
        UniqueConstraint("user_id", "name", "transaction_type", name="uq_cat_user_name_type"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)  # Always positive magnitude
    currency = Column(String(3), default="INR", nullable=False)
    transaction_type = Column(String(20), nullable=False)  # income, expense
    transaction_date = Column(Date, nullable=False, index=True)
    description = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")

    __table_args__ = (
        Index("idx_tx_user_date", "user_id", "transaction_date"),
        Index("idx_tx_user_cat", "user_id", "category_id"),
    )


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    limit_amount = Column(Numeric(15, 2), nullable=False)
    warning_threshold = Column(Numeric(5, 2), default=Decimal("80.00"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")

    __table_args__ = (
        Index("idx_budgets_user_period", "user_id", "period_start", "period_end"),
    )


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    target_amount = Column(Numeric(15, 2), nullable=False)
    current_saved_amount = Column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    target_date = Column(Date, nullable=True)
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    status = Column(String(20), default="active", nullable=False)  # active, completed, paused, archived
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="goals")
    contributions = relationship("GoalContribution", back_populates="goal", cascade="all, delete-orphan")


class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    goal_id = Column(Integer, ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    contribution_date = Column(Date, nullable=False)
    notes = Column(String(255), nullable=True)
    idempotency_key = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    goal = relationship("SavingsGoal", back_populates="contributions")


class RecurringBill(Base):
    __tablename__ = "recurring_bills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(120), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    frequency = Column(String(20), default="monthly", nullable=False)  # weekly, monthly, quarterly, yearly
    next_due_date = Column(Date, nullable=False)
    status = Column(String(20), default="upcoming", nullable=False)  # upcoming, paid, overdue
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="bills")


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    outstanding_balance = Column(Numeric(15, 2), nullable=False)
    interest_rate = Column(Numeric(6, 3), nullable=False)  # annual percentage rate
    minimum_payment = Column(Numeric(15, 2), nullable=False)
    payment_frequency = Column(String(20), default="monthly", nullable=False)
    target_payoff_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="debts")


class ForecastScenario(Base):
    __tablename__ = "forecast_scenarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    assumptions = Column(Text, nullable=False)  # JSON string
    projection = Column(Text, nullable=False)   # JSON string
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="forecasts")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_type = Column(String(80), nullable=False)
    status = Column(String(20), default="completed", nullable=False)  # queued, running, completed, failed
    prompt = Column(Text, nullable=True)
    logs = Column(Text, nullable=True)  # JSON string of agent steps
    execution_time_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="agent_runs")
    recommendations = relationship("Recommendation", back_populates="agent_run")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_run_id = Column(Integer, ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    recommendation_type = Column(String(80), nullable=False)
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    supporting_figures = Column(Text, nullable=True)  # JSON string
    suggested_action = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, rejected
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="recommendations")
    agent_run = relationship("AgentRun", back_populates="recommendations")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(80), nullable=True)
    entity_id = Column(String(80), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="audit_events")



class EmailOTP(Base):
    """Hashed one-time codes for email verification and password reset."""
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(254), index=True, nullable=False)
    purpose = Column(String(20), nullable=False)  # signup, reset
    code_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("email", "purpose", name="uq_otp_email_purpose"),
    )
