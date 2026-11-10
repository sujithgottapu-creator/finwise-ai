import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, AgentRun, Recommendation, AuditEvent
from app.schemas.schemas import ChatRequest, ChatResponse, RecommendationOut, AgentRunOut
from app.api.deps import get_current_user
from app.agents.coordinator import CoordinatorAgent
from app.services.email_service import send_ai_agent_report_email, trigger_n8n_agent_webhook

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    coordinator = CoordinatorAgent(db, current_user)
    result = await coordinator.execute_workflow(data.message)
    return result

@router.get("/runs", response_model=List[AgentRunOut])
def list_agent_runs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    runs = db.query(AgentRun).filter(
        AgentRun.user_id == current_user.id
    ).order_by(AgentRun.created_at.desc()).limit(20).all()
    return [AgentRunOut.model_validate(r) for r in runs]

@router.get("/runs/{id}", response_model=Dict[str, Any])
def get_agent_run(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    run = db.query(AgentRun).filter(
        AgentRun.id == id,
        AgentRun.user_id == current_user.id
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found.")

    return {
        "id": run.id,
        "workflow_type": run.workflow_type,
        "status": run.status,
        "prompt": run.prompt,
        "logs": json.loads(run.logs or "[]"),
        "execution_time_ms": run.execution_time_ms,
        "created_at": run.created_at,
        "finished_at": run.finished_at
    }

@router.get("/recommendations", response_model=List[RecommendationOut])
def list_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recs = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id
    ).order_by(Recommendation.created_at.desc()).all()

    out = []
    for r in recs:
        out.append(RecommendationOut(
            id=r.id,
            agent_run_id=r.agent_run_id,
            recommendation_type=r.recommendation_type,
            title=r.title,
            explanation=r.explanation,
            supporting_figures=json.loads(r.supporting_figures or "{}"),
            suggested_action=r.suggested_action,
            status=r.status,
            created_at=r.created_at
        ))
    return out

@router.post("/recommendations/{id}/approve")
def approve_recommendation(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(Recommendation).filter(
        Recommendation.id == id,
        Recommendation.user_id == current_user.id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    rec.status = "approved"

    audit = AuditEvent(
        user_id=current_user.id,
        action="RECOMMENDATION_APPROVED",
        entity_type="recommendation",
        entity_id=str(rec.id),
        details=f'{{"title": "{rec.title}"}}'
    )
    db.add(audit)
    db.commit()

    return {"message": "Recommendation approved successfully.", "id": id, "status": "approved"}

@router.post("/recommendations/{id}/reject")
def reject_recommendation(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(Recommendation).filter(
        Recommendation.id == id,
        Recommendation.user_id == current_user.id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    rec.status = "rejected"

    audit = AuditEvent(
        user_id=current_user.id,
        action="RECOMMENDATION_REJECTED",
        entity_type="recommendation",
        entity_id=str(rec.id),
        details=f'{{"title": "{rec.title}"}}'
    )
    db.add(audit)
    db.commit()

    return {"message": "Recommendation rejected.", "id": id, "status": "rejected"}

@router.post("/email-report")
async def email_ai_report(
    payload: Dict[str, str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sends the latest multi-agent AI financial summary directly to the user's email."""
    subject = payload.get("subject", "FinWise AI Financial Plan & Insights")
    content = payload.get("content", "Here is your multi-agent financial planning summary.")
    
    send_ai_agent_report_email(
        to_email=current_user.email,
        display_name=current_user.display_name,
        subject=subject,
        report_body=content
    )
    
    await trigger_n8n_agent_webhook("ai.report_emailed", {
        "user_id": current_user.id,
        "email": current_user.email,
        "subject": subject
    })
    
    return {"message": f"Financial report successfully sent to {current_user.email}!"}
