"""Request dependencies: listener identity from the `X-Listener-Id` header."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.models import Listener


def parse_listener_id(value: str | None) -> UUID | None:
    """Return the UUID if `value` is a canonical hyphenated UUID v4, else None."""
    if value is None:
        return None
    try:
        parsed = UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None
    if parsed.version != 4 or str(parsed) != value.lower():
        return None
    return parsed


def get_listener(
    session: Annotated[Session, Depends(get_session)],
    x_listener_id: Annotated[str | None, Header()] = None,
) -> Listener:
    """Validate `X-Listener-Id` (400 if missing or not a UUID v4) and return the
    Listener row, creating it with defaults on first use."""
    listener_id = parse_listener_id(x_listener_id)
    if listener_id is None:
        raise HTTPException(status_code=400, detail="Missing or malformed X-Listener-Id header")
    listener = session.get(Listener, listener_id)
    if listener is None:
        listener = Listener(listener_id=listener_id)
        session.add(listener)
        session.commit()
        session.refresh(listener)
    return listener
