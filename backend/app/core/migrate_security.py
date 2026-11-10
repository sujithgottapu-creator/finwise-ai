"""Lightweight, idempotent column additions so existing databases keep working.

`Base.metadata.create_all` creates new tables (like email_otps) but never alters
existing ones, so the three new security columns on `users` are added here.
Existing accounts are treated as already verified.
"""
import logging
from sqlalchemy import inspect, text

logger = logging.getLogger("finwise-migrate")

_COLUMNS = [
    ("email_verified", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("failed_login_attempts", "INTEGER NOT NULL DEFAULT 0"),
    ("locked_until", "TIMESTAMP NULL"),
]


def ensure_security_columns(engine) -> None:
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("users")}
    with engine.begin() as conn:
        for name, ddl in _COLUMNS:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))
                logger.info("Added users.%s", name)
