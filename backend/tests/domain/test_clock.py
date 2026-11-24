"""Property tests for domain/clock.py.

**Validates: Requirements 12.7, 12.8**
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, strategies as st

from app.domain.clock import TIME_SCALE_WARP, Clock, set_scale, virtual_now

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
offsets = st.timedeltas(min_value=timedelta(0), max_value=timedelta(days=365))
instants = offsets.map(lambda d: T0 + d)
scales = st.sampled_from([1, TIME_SCALE_WARP])


@st.composite
def clocks(draw, scale=scales):
    return Clock(draw(scale), draw(instants), draw(instants))


@given(clocks(), offsets, offsets)
def test_virtual_time_never_decreases(clock, d1, d2):
    lo, hi = sorted((d1, d2))
    base = clock.anchor_real
    assert virtual_now(clock, base + lo) <= virtual_now(clock, base + hi)


@given(clocks(st.just(1)), offsets)
def test_scale_one_equals_real_elapsed(clock, elapsed):
    now = clock.anchor_real + elapsed
    assert virtual_now(clock, now) - clock.anchor_virtual == elapsed


@given(clocks(st.just(TIME_SCALE_WARP)), offsets)
def test_scale_warp_is_1440_times_real_elapsed(clock, elapsed):
    now = clock.anchor_real + elapsed
    assert virtual_now(clock, now) - clock.anchor_virtual == elapsed * 1440


@given(clocks(), offsets, scales)
def test_set_scale_keeps_virtual_time_continuous(clock, elapsed, new_scale):
    now = clock.anchor_real + elapsed
    updated = set_scale(clock, now, new_scale)
    assert updated.scale == new_scale
    assert virtual_now(updated, now) == virtual_now(clock, now)


@given(clocks(), offsets, offsets, scales)
def test_set_scale_then_time_advances_at_new_scale(clock, d1, d2, new_scale):
    now = clock.anchor_real + d1
    updated = set_scale(clock, now, new_scale)
    assert virtual_now(updated, now + d2) - virtual_now(clock, now) == d2 * new_scale


def test_set_scale_rejects_unsupported_scale():
    clock = Clock(1, T0, T0)
    with pytest.raises(ValueError):
        set_scale(clock, T0, 60)
