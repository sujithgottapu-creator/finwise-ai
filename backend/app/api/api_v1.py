from fastapi import APIRouter
from app.api.endpoints import (
    auth, onboarding, dashboard, transactions, budgets, 
    goals, bills, debts, forecasts, reports, ai, settings, admin, categories
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
api_router.include_router(goals.router, prefix="/goals", tags=["Savings Goals"])
api_router.include_router(bills.router, prefix="/bills", tags=["Recurring Bills"])
api_router.include_router(debts.router, prefix="/debts", tags=["Debts"])
api_router.include_router(forecasts.router, prefix="/forecasts", tags=["Forecasts"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Copilot & Multi-Agent"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings & Privacy"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration"])
