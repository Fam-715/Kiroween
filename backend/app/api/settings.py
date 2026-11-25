"""Settings API: per-listener Demo mode and Demo time warp (Requirements 12.1, 12.2, 12.4-12.8)."""

import os
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session as DbSession

from app.db import get_session
from app.deps import get_listener
from app.domain.clock import TIME_SCALE_REAL, TIME_SCALE_WARP, Clock, set_scale, virtual_now
from app.models import Listener, utcnow
from app.schemas import SettingsIn, SettingsOut

router = APIRouter(tags=["settings"])

Db = Annotated[DbSession, Depends(get_session)]
CurrentListener = Annotated[Listener, Depends(get_listener)]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _time_warp_allowed() -> bool:
    return os.environ.get("ALLOW_TIME_WARP", "").strip().lower() == "true"


def _clock(listener: Listener) -> Clock:
    return Clock(
        scale=listener.time_scale,
        anchor_real=_aware(listener.clock_anchor_real),
        anchor_virtual=_aware(listener.clock_anchor_virtual),
    )


def _settings_out(listener: Listener) -> SettingsOut:
    real_now = utcnow()
    return SettingsOut(
        demo_mode=listener.demo_mode,
        time_warp_allowed=_time_warp_allowed(),
        time_warp_enabled=listener.time_scale == TIME_SCALE_WARP,
        time_scale=listener.time_scale,
        real_now=real_now,
        virtual_now=virtual_now(_clock(listener), real_now),
    )


@router.get("/settings", response_model=SettingsOut)
def get_settings(listener: CurrentListener) -> SettingsOut:
    return _settings_out(listener)


@router.put("/settings", response_model=SettingsOut)
def put_settings(body: SettingsIn, db: Db, listener: CurrentListener) -> SettingsOut:
    if body.time_warp is True and not _time_warp_allowed():
        raise HTTPException(status_code=403, detail="Time warp is not allowed on this server")
    if body.demo_mode is not None:
        listener.demo_mode = body.demo_mode
    if body.time_warp is not None:
        scale = TIME_SCALE_WARP if body.time_warp else TIME_SCALE_REAL
        if scale != listener.time_scale:
            clock = set_scale(_clock(listener), utcnow(), scale)
            listener.time_scale = clock.scale
            listener.clock_anchor_real = clock.anchor_real
            listener.clock_anchor_virtual = clock.anchor_virtual
    db.add(listener)
    db.commit()
    db.refresh(listener)
    return _settings_out(listener)
