"""Settings API: per-listener Demo mode (Requirements 12.1, 12.2)."""

import os
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session as DbSession

from app.db import get_session
from app.deps import get_listener
from app.domain.clock import TIME_SCALE_REAL, Clock, virtual_now
from app.models import Listener, utcnow
from app.schemas import SettingsIn, SettingsOut

router = APIRouter(tags=["settings"])

Db = Annotated[DbSession, Depends(get_session)]
CurrentListener = Annotated[Listener, Depends(get_listener)]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _settings_out(listener: Listener) -> SettingsOut:
    # Time warp stays off until the PUT /settings/time_warp endpoint exists (task 14.1).
    real_now = utcnow()
    clock = Clock(
        scale=TIME_SCALE_REAL,
        anchor_real=_aware(listener.clock_anchor_real),
        anchor_virtual=_aware(listener.clock_anchor_virtual),
    )
    return SettingsOut(
        demo_mode=listener.demo_mode,
        time_warp_allowed=os.environ.get("ALLOW_TIME_WARP", "").strip().lower() == "true",
        time_warp_enabled=False,
        time_scale=TIME_SCALE_REAL,
        real_now=real_now,
        virtual_now=virtual_now(clock, real_now),
    )


@router.get("/settings", response_model=SettingsOut)
def get_settings(listener: CurrentListener) -> SettingsOut:
    return _settings_out(listener)


@router.put("/settings", response_model=SettingsOut)
def put_settings(body: SettingsIn, db: Db, listener: CurrentListener) -> SettingsOut:
    listener.demo_mode = body.demo_mode
    db.add(listener)
    db.commit()
    db.refresh(listener)
    return _settings_out(listener)
