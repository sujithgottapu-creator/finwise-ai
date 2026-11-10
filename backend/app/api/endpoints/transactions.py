import io
import csv
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.core.database import get_db
from app.models.models import User, Transaction, Category, Account, AuditEvent
from app.schemas.schemas import TransactionCreate, TransactionUpdate, TransactionOut, CsvImportResult
from app.api.deps import get_current_user
from app.services.calculations import to_decimal

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
def list_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = Query("date", pattern="^(date|amount)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if transaction_type in ["income", "expense"]:
        query = query.filter(Transaction.transaction_type == transaction_type)
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    total = query.count()

    order_col = Transaction.transaction_date if sort_by == "date" else Transaction.amount
    if order == "desc":
        query = query.order_by(desc(order_col), desc(Transaction.id))
    else:
        query = query.order_by(asc(order_col), asc(Transaction.id))

    txs = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for t in txs:
        items.append({
            "id": t.id,
            "amount": t.amount,
            "currency": t.currency,
            "transaction_type": t.transaction_type,
            "transaction_date": t.transaction_date,
            "description": t.description,
            "category_id": t.category_id,
            "category_name": t.category.name if t.category else "Uncategorized",
            "category_color": t.category.color if t.category else "#16A36A",
            "notes": t.notes,
            "created_at": t.created_at
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }

@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Transaction amount must be strictly greater than 0.")

    # Validate category ownership if provided
    if data.category_id:
        cat = db.query(Category).filter(
            Category.id == data.category_id,
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")

    # Validate account ownership if provided (prevent IDOR)
    if data.account_id:
        acc = db.query(Account).filter(
            Account.id == data.account_id,
            Account.user_id == current_user.id
        ).first()
        if not acc:
            raise HTTPException(status_code=400, detail="Invalid account ID.")

    tx = Transaction(
        user_id=current_user.id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=data.amount,
        currency=data.currency.upper(),
        transaction_type=data.transaction_type,
        transaction_date=data.transaction_date,
        description=data.description.strip(),
        notes=data.notes
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return TransactionOut(
        id=tx.id,
        amount=tx.amount,
        currency=tx.currency,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        description=tx.description,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else None,
        category_color=tx.category.color if tx.category else None,
        notes=tx.notes,
        created_at=tx.created_at
    )

@router.get("/{id}", response_model=TransactionOut)
def get_transaction(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    return TransactionOut(
        id=tx.id,
        amount=tx.amount,
        currency=tx.currency,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        description=tx.description,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else None,
        category_color=tx.category.color if tx.category else None,
        notes=tx.notes,
        created_at=tx.created_at
    )

@router.patch("/{id}", response_model=TransactionOut)
def update_transaction(
    id: int,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if data.amount is not None:
        if data.amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Amount must be positive.")
        tx.amount = data.amount

    if data.transaction_type is not None:
        tx.transaction_type = data.transaction_type

    if data.transaction_date is not None:
        tx.transaction_date = data.transaction_date

    if data.description is not None:
        tx.description = data.description.strip()

    if data.category_id is not None:
        cat = db.query(Category).filter(
            Category.id == data.category_id,
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID.")
        tx.category_id = data.category_id

    if data.notes is not None:
        tx.notes = data.notes

    db.commit()
    db.refresh(tx)

    return TransactionOut(
        id=tx.id,
        amount=tx.amount,
        currency=tx.currency,
        transaction_type=tx.transaction_type,
        transaction_date=tx.transaction_date,
        description=tx.description,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else None,
        category_color=tx.category.color if tx.category else None,
        notes=tx.notes,
        created_at=tx.created_at
    )

@router.delete("/{id}")
def delete_transaction(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully.", "id": id}

@router.post("/import", response_model=CsvImportResult)
async def import_transactions_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please supply a UTF-8 CSV.")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers.")

    # Expected column matching
    imported = 0
    duplicates = []
    errors = []
    row_num = 1

    # Load categories for user
    categories = db.query(Category).filter(
        (Category.user_id == current_user.id) | (Category.user_id == None)
    ).all()
    cat_lookup = {c.name.lower(): c.id for c in categories}

    for row in reader:
        row_num += 1
        try:
            # Flexible header mapping
            desc_val = row.get("description") or row.get("Description") or row.get("narrative") or ""
            desc_val = desc_val.strip()
            if not desc_val:
                continue

            raw_amt = row.get("amount") or row.get("Amount") or "0"
            raw_amt = raw_amt.replace(",", "").replace("₹", "").replace("$", "").strip()
            amt_val = Decimal(raw_amt)
            if amt_val <= Decimal("0.00"):
                continue

            t_type = (row.get("type") or row.get("Type") or "expense").strip().lower()
            if t_type not in ["income", "expense"]:
                t_type = "expense"

            raw_date = row.get("date") or row.get("Date") or str(date.today())
            try:
                tx_date = datetime.strptime(raw_date.strip(), "%Y-%m-%d").date()
            except ValueError:
                try:
                    tx_date = datetime.strptime(raw_date.strip(), "%d-%m-%Y").date()
                except ValueError:
                    tx_date = date.today()

            # Category resolution
            raw_cat = (row.get("category") or row.get("Category") or "").strip().lower()
            cat_id = cat_lookup.get(raw_cat)

            # Check potential duplicate: same amount, date, description, user
            dup = db.query(Transaction).filter(
                Transaction.user_id == current_user.id,
                Transaction.transaction_date == tx_date,
                Transaction.amount == amt_val,
                Transaction.description == desc_val
            ).first()

            if dup:
                duplicates.append({
                    "row": row_num,
                    "date": str(tx_date),
                    "description": desc_val,
                    "amount": float(amt_val)
                })
                continue

            # Insert transaction
            tx = Transaction(
                user_id=current_user.id,
                amount=amt_val,
                currency=current_user.currency,
                transaction_type=t_type,
                transaction_date=tx_date,
                description=desc_val,
                category_id=cat_id,
                notes="Imported via CSV"
            )
            db.add(tx)
            imported += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    db.commit()

    return CsvImportResult(
        total_rows=row_num - 1,
        imported_count=imported,
        duplicate_count=len(duplicates),
        duplicates_detected=duplicates,
        errors=errors
    )

@router.get("/export")
def export_transactions_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    transaction_type: Optional[str] = None
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if transaction_type in ["income", "expense"]:
        query = query.filter(Transaction.transaction_type == transaction_type)
    txs = query.order_by(desc(Transaction.transaction_date)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Description", "Type", "Amount", "Currency", "Category", "Notes"])

    for t in txs:
        writer.writerow([
            t.id,
            t.transaction_date.isoformat(),
            t.description,
            t.transaction_type,
            f"{t.amount:.2f}",
            t.currency,
            t.category.name if t.category else "Uncategorized",
            t.notes or ""
        ])

    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=finwise_transactions_{date.today().isoformat()}.csv"
    return response
