from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.core.security import validate_password_strength

# ----------------- AUTH SCHEMAS -----------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    display_name: str = Field(min_length=2, max_length=120)
    currency: str = Field(default="INR", max_length=3)

    @field_validator("display_name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2 or any(c in v for c in "<>"):
            raise ValueError("Please enter a valid name.")
        return v

    @model_validator(mode="after")
    def _check_password(self):
        validate_password_strength(self.password, str(self.email))
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class RegisterPending(BaseModel):
    message: str
    email: str
    requires_verification: bool = True

class EmailCodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

class ResendCode(BaseModel):
    email: EmailStr
    purpose: Literal["signup", "reset"] = "signup"

class PasswordForgot(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=1, max_length=72)

    @model_validator(mode="after")
    def _check_password(self):
        validate_password_strength(self.new_password, str(self.email))
        return self

class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    currency: str
    role: str
    is_active: bool
    is_onboarded: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- PROFILE & ONBOARDING -----------------
class OnboardingStep1(BaseModel):
    display_name: str
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    age_range: Optional[str] = None

class OnboardingStep2(BaseModel):
    monthly_income: Decimal = Field(ge=0)
    income_frequency: str = "monthly"
    essential_expenses: Decimal = Field(ge=0)
    discretionary_expenses: Decimal = Field(ge=0)
    current_savings: Decimal = Field(ge=0)
    total_debt: Decimal = Field(default=Decimal("0.00"), ge=0)

class InitialGoal(BaseModel):
    name: str
    target_amount: Decimal = Field(gt=0)
    target_date: Optional[date] = None
    priority: str = "medium"

class OnboardingSubmit(BaseModel):
    profile: OnboardingStep1
    financials: OnboardingStep2
    goals: List[InitialGoal] = []
    initial_budget_confirmed: bool = True

class FinancialProfileOut(BaseModel):
    monthly_income: Decimal
    income_frequency: str
    essential_expenses: Decimal
    discretionary_expenses: Decimal
    current_savings: Decimal
    total_debt: Decimal
    timezone: str
    age_range: Optional[str]
    is_onboarded: bool

    class Config:
        from_attributes = True

# ----------------- CATEGORY SCHEMAS -----------------
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    transaction_type: Literal["income", "expense"]
    icon: str = "circle"
    color: str = "#16A36A"

class CategoryOut(BaseModel):
    id: int
    name: str
    transaction_type: str
    icon: str
    color: str

    class Config:
        from_attributes = True

# ----------------- TRANSACTION SCHEMAS -----------------
class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="INR", max_length=3)
    transaction_type: Literal["income", "expense"]
    transaction_date: date
    description: str = Field(min_length=1, max_length=255)
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    notes: Optional[str] = None

class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    transaction_type: Optional[Literal["income", "expense"]] = None
    transaction_date: Optional[date] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category_id: Optional[int] = None
    notes: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    amount: Decimal
    currency: str
    transaction_type: str
    transaction_date: date
    description: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class CsvImportResult(BaseModel):
    total_rows: int
    imported_count: int
    duplicate_count: int
    duplicates_detected: List[Dict[str, Any]]
    errors: List[str]

# ----------------- BUDGET SCHEMAS -----------------
class BudgetCreate(BaseModel):
    category_id: int
    period_start: date
    period_end: date
    limit_amount: Decimal = Field(ge=0)
    warning_threshold: Decimal = Field(default=Decimal("80.00"), ge=1, le=100)

class BudgetUpdate(BaseModel):
    limit_amount: Optional[Decimal] = Field(default=None, ge=0)
    warning_threshold: Optional[Decimal] = Field(default=None, ge=1, le=100)

class BudgetOut(BaseModel):
    id: int
    category_id: int
    category_name: str
    period_start: date
    period_end: date
    limit_amount: Decimal
    spent_amount: Decimal = Decimal("0.00")
    remaining_amount: Decimal = Decimal("0.00")
    usage_percentage: float = 0.0
    warning_threshold: Decimal
    status: Literal["healthy", "warning", "exceeded"] = "healthy"

    class Config:
        from_attributes = True

# ----------------- SAVINGS GOAL SCHEMAS -----------------
class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: Decimal = Field(gt=0)
    current_saved_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    currency: str = Field(default="INR", max_length=3)
    target_date: Optional[date] = None
    priority: Literal["low", "medium", "high"] = "medium"

class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[Decimal] = Field(default=None, gt=0)
    target_date: Optional[date] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    status: Optional[Literal["active", "completed", "paused", "archived"]] = None

class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    contribution_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class GoalContributionOut(BaseModel):
    id: int
    goal_id: int
    amount: Decimal
    contribution_date: date
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class SavingsGoalOut(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_saved_amount: Decimal
    remaining_amount: Decimal
    currency: str
    target_date: Optional[date]
    priority: str
    status: str
    completion_percentage: float
    required_monthly_contribution: Decimal
    months_remaining: int
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- RECURRING BILL SCHEMAS -----------------
class RecurringBillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="INR", max_length=3)
    frequency: Literal["weekly", "monthly", "quarterly", "yearly"] = "monthly"
    next_due_date: date
    category_id: Optional[int] = None
    notes: Optional[str] = None

class RecurringBillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    frequency: Optional[Literal["weekly", "monthly", "quarterly", "yearly"]] = None
    next_due_date: Optional[date] = None
    status: Optional[Literal["upcoming", "paid", "overdue"]] = None
    notes: Optional[str] = None

class RecurringBillOut(BaseModel):
    id: int
    name: str
    amount: Decimal
    currency: str
    frequency: str
    next_due_date: date
    status: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    notes: Optional[str]

    class Config:
        from_attributes = True

# ----------------- DEBT SCHEMAS -----------------
class DebtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    outstanding_balance: Decimal = Field(gt=0)
    interest_rate: Decimal = Field(ge=0, le=100)
    minimum_payment: Decimal = Field(gt=0)
    payment_frequency: Literal["monthly", "biweekly", "weekly"] = "monthly"
    target_payoff_date: Optional[date] = None

class DebtUpdate(BaseModel):
    name: Optional[str] = None
    outstanding_balance: Optional[Decimal] = Field(default=None, ge=0)
    interest_rate: Optional[Decimal] = Field(default=None, ge=0, le=100)
    minimum_payment: Optional[Decimal] = Field(default=None, gt=0)
    target_payoff_date: Optional[date] = None

class DebtOut(BaseModel):
    id: int
    name: str
    outstanding_balance: Decimal
    interest_rate: Decimal
    minimum_payment: Decimal
    payment_frequency: str
    target_payoff_date: Optional[date]

    class Config:
        from_attributes = True

class DebtStrategyRequest(BaseModel):
    monthly_extra_payment: Decimal = Field(default=Decimal("0.00"), ge=0)

class DebtStrategySchedule(BaseModel):
    months_to_payoff: int
    total_interest_paid: Decimal
    estimated_payoff_date: Optional[str]
    details: List[Dict[str, Any]]

class DebtStrategyResult(BaseModel):
    avalanche: DebtStrategySchedule
    snowball: DebtStrategySchedule
    recommended_strategy: str
    interest_saved_with_avalanche: Decimal

# ----------------- FORECAST SCHEMAS -----------------
class ForecastSimulateRequest(BaseModel):
    months: int = Field(default=12, ge=1, le=60)
    custom_monthly_income: Optional[Decimal] = Field(default=None, ge=0)
    custom_monthly_expenses: Optional[Decimal] = Field(default=None, ge=0)
    one_time_purchases: List[Dict[str, Any]] = []  # [{"month": 3, "amount": 10000, "name": "Laptop"}]
    monthly_savings_contribution: Decimal = Field(default=Decimal("0.00"), ge=0)
    unexpected_expense_buffer: Decimal = Field(default=Decimal("0.00"), ge=0)
    annual_investment_return_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=50)

class ForecastMonthPoint(BaseModel):
    month_index: int
    month_name: str
    expected_income: Decimal
    expected_expenses: Decimal
    net_cash_flow: Decimal
    projected_balance: Decimal
    best_case_balance: Decimal
    adverse_case_balance: Decimal

class ForecastSimulateResult(BaseModel):
    months: int
    starting_balance: Decimal
    ending_balance_expected: Decimal
    ending_balance_best: Decimal
    ending_balance_adverse: Decimal
    timeline: List[ForecastMonthPoint]
    assumptions: List[str]
    warnings: List[str]

# ----------------- AI & RECOMMENDATIONS -----------------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    scenario_id: Optional[int] = None

class AgentStepLog(BaseModel):
    agent: str
    action: str
    output_summary: str

class RecommendationOut(BaseModel):
    id: int
    agent_run_id: Optional[int]
    recommendation_type: str
    title: str
    explanation: str
    supporting_figures: Dict[str, Any] = {}
    suggested_action: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    reply: str
    agent_steps: List[AgentStepLog] = []
    recommendation: Optional[RecommendationOut] = None
    data_sources: List[str] = []
    requires_approval: bool = False

# ----------------- DASHBOARD & REPORTS -----------------
class DashboardSummary(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_cash_flow: Decimal
    savings_rate: float
    income_change_pct: float
    expense_change_pct: float
    period_label: str
    currency: str = "INR"

class CashFlowPoint(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal

class SpendingCategoryBreakdown(BaseModel):
    category_id: Optional[int]
    category_name: str
    color: str
    amount: Decimal
    percentage: float

# ----------------- ADMIN SCHEMAS -----------------
class AdminHealth(BaseModel):
    status: str
    database: str
    ai_provider: str
    active_users: int
    total_transactions: int
    system_version: str

class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_transactions: int
    total_volume_inr: Decimal
    total_agent_runs: int
    failed_agent_runs: int
    system_uptime: str

class UserAdminOut(BaseModel):
    id: int
    display_name: str
    email: str
    currency: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AgentRunOut(BaseModel):
    id: int
    user_id: int
    workflow_type: str
    status: str
    prompt: Optional[str]
    execution_time_ms: int
    created_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True

class AuditEventOut(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
