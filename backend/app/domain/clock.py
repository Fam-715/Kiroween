"""Virtual clock used for memory decay.

Pure functions only, no I/O. Virtual time runs at ``scale`` times real time from an
anchor pair, so changing the scale keeps virtual time continuous.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

TIME_SCALE_REAL = 1
TIME_SCALE_WARP = 1440  # 1 day = 1 minute
ALLOWED_SCALES = (TIME_SCALE_REAL, TIME_SCALE_WARP)


@dataclass(frozen=True)
class Clock:
    scale: int
    anchor_real: datetime
    anchor_virtual: datetime


def virtual_now(clock: Clock, real_now: datetime) -> datetime:
    """anchor_virtual + (real_now - anchor_real) * scale."""
    return clock.anchor_virtual + (real_now - clock.anchor_real) * clock.scale


def set_scale(clock: Clock, real_now: datetime, scale: int) -> Clock:
    """Return a clock with a new scale whose virtual time is continuous at ``real_now``."""
    if scale not in ALLOWED_SCALES:
        raise ValueError(f"scale must be one of {ALLOWED_SCALES}, got {scale!r}")
    return Clock(scale, real_now, virtual_now(clock, real_now))
