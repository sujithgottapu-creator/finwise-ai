from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.models import User, Category
from app.schemas.schemas import CategoryCreate, CategoryOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[CategoryOut])
def list_categories(
    transaction_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Category).filter(
        or_(Category.user_id == current_user.id, Category.user_id == None)
    )
    if transaction_type in ["income", "expense"]:
        query = query.filter(Category.transaction_type == transaction_type)
    
    categories = query.order_by(Category.name.asc()).all()
    return [CategoryOut.model_validate(c) for c in categories]

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if category with same name and type already exists for this user
    existing = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.name.ilike(data.name.strip()),
        Category.transaction_type == data.transaction_type
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A category named '{data.name.strip()}' already exists for {data.transaction_type}."
        )

    cat = Category(
        user_id=current_user.id,
        name=data.name.strip(),
        transaction_type=data.transaction_type,
        icon=data.icon,
        color=data.color
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)
