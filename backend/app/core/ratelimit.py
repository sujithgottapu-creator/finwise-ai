"""Small in-memory sliding-window rate limiter (per process).

Good enough for a single API instance; account lockout and OTP attempt limits
are stored in the database so they survive restarts and multiple workers.
"""
import time
import threading
from collections import defaultdict, deque
from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_hits: dict = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a moment and try again.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)


def reset_rate_limits() -> None:
    with _lock:
        _hits.clear()
