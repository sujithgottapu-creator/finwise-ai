from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.models import User, Transaction, AgentRun, AuditEvent
from app.schemas.schemas import AdminHealth, AdminStats, UserAdminOut, AgentRunOut, AuditEventOut
from app.api.deps import get_admin_user
from app.core.config import settings

router = APIRouter()

@router.get("/health", response_model=AdminHealth)
def get_system_health(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    try:
        # Check DB
        db.execute(func.now()).scalar()
        db_status = "connected_and_healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    user_count = db.query(User).filter(User.is_active == True).count()
    tx_count = db.query(Transaction).count()
    ai_status = "gemini_api_configured" if settings.GEMINI_API_KEY else "deterministic_rules_active"

    return AdminHealth(
        status="operational",
        database=db_status,
        ai_provider=ai_status,
        active_users=user_count,
        total_transactions=tx_count,
        system_version=settings.VERSION
    )

@router.get("/stats", response_model=AdminStats)
def get_admin_stats(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    total_txs = db.query(Transaction).count()
    
    total_vol = db.query(func.sum(Transaction.amount)).scalar() or Decimal("0.00")
    total_runs = db.query(AgentRun).count()
    failed_runs = db.query(AgentRun).filter(AgentRun.status == "failed").count()

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_transactions=total_txs,
        total_volume_inr=total_vol,
        total_agent_runs=total_runs,
        failed_agent_runs=failed_runs,
        system_uptime="100.0% (Operational)"
    )

@router.get("/users")
def list_admin_users(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).limit(100).all()
    return [
        {
            "id": u.id,
            "display_name": u.display_name,
            "email": u.email,
            "currency": u.currency,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at
        }
        for u in users
    ]

@router.get("/agents")
def list_admin_agent_runs(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    runs = db.query(AgentRun).order_by(AgentRun.created_at.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "workflow_type": r.workflow_type,
            "status": r.status,
            "prompt": r.prompt,
            "execution_time_ms": r.execution_time_ms,
            "created_at": r.created_at,
            "finished_at": r.finished_at
        }
        for r in runs
    ]

@router.get("/audit-events")
def list_admin_audit_events(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(50).all()
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "details": e.details,
            "created_at": e.created_at
        }
        for e in events
    ]
