from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.migrate_security import ensure_security_columns
from app.core.security import verify_password
from app.models.models import User
from app.api.api_v1 import api_router
from app.services.seed_data import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finwise-api")

def _disable_public_default_admin(db):
    """The old default admin password (Admin1234!) was published in the README, so any
    account still using it is disabled until its owner sets a private password."""
    admin = db.query(User).filter(User.email == "admin@finwise.ai").first()
    if admin and admin.is_active and verify_password("Admin1234!", admin.password_hash):
        admin.is_active = False
        db.commit()
        logger.warning(
            "Disabled admin@finwise.ai because it still used the publicly known default password. "
            "Set DEFAULT_ADMIN_PASSWORD and re-create it, or reset the password in the database."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed demonstration data
    logger.info("Initializing FinWise AI database schemas...")
    try:
        Base.metadata.create_all(bind=engine)
        ensure_security_columns(engine)
        db = SessionLocal()
        try:
            seed_demo_data(db)
            logger.info("Demonstration account seeded successfully (demo@finwise.ai).")
            _disable_public_default_admin(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error during database startup initialization: {e}")
    yield
    logger.info("FinWise AI backend shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-oriented AI-powered personal financial planning platform API.",
    lifespan=lifespan
)

# CORS: only your own frontends. Auth uses a Bearer token (no cookies), so credentials stay off.
_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL:
    _origins.append(settings.FRONTEND_URL.rstrip("/"))
_origins += [o.strip().rstrip("/") for o in settings.EXTRA_CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(set(_origins)),
    allow_origin_regex=r"https://finwise-ai[a-z0-9\-]*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("Cache-Control", "no-store")
    return response

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact support or retry."}
    )

# Include v1 Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "finwise-ai-api",
        "version": settings.VERSION,
        "database": "connected"
    }

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Welcome to FinWise AI API.",
        "documentation": "/docs",
        "version": settings.VERSION
    }
