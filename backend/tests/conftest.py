import os

# Must be set before the app is imported: lets tests run without a real email provider.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_finwise.db")

import pytest
from app.core.ratelimit import reset_rate_limits


@pytest.fixture(scope="session", autouse=True)
def _init_database():
    """TestClient(app) without a `with` block skips the startup hook, so build the schema here."""
    from app.core.database import engine, Base, SessionLocal
    from app.core.migrate_security import ensure_security_columns
    from app.services.seed_data import seed_demo_data
    import app.models.models  # noqa: F401  (register tables)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    ensure_security_columns(engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    yield
    engine.dispose()
    try:
        os.remove("test_finwise.db")
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_rate_limits()
    yield


@pytest.fixture
def sent_codes(monkeypatch):
    """Captures one-time codes instead of emailing them: {(email, purpose): code}."""
    codes = {}

    def fake_send(to_email, display_name, code, purpose):
        codes[(to_email.lower(), purpose)] = code
        return True

    monkeypatch.setattr("app.api.endpoints.auth.send_otp_email", fake_send)
    return codes
