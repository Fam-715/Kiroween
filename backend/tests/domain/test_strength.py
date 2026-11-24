"""Property tests for domain/strength.py.

**Validates: Requirements 4.1-4.5, 4.9, 6.1-6.11, 6.13, 8.4, 8.5**
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from hypothesis import given, strategies as st

from app.domain import strength as st_mod
from app.domain.strength import (
    S_MAX,
    S_MIN,
    TrackMemory,
    apply_penalty,
    condition,
    is_ghost,
    is_due,
    next_review_at,
    review,
    strength_at,
    tape_condition,
    tape_strength,
)

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
stab = st.floats(min_value=S_MIN, max_value=S_MAX, allow_nan=False)
days = st.floats(min_value=0, max_value=1000, allow_nan=False)
score_st = st.floats(min_value=0, max_value=1, allow_nan=False)
strengths = st.lists(st.integers(0, 100), min_size=1, max_size=12)
CONDITIONS = ["Dead", "Haunted", "Warped", "Worn", "Mint"]


@st.composite
def memories(draw):
    count = draw(st.integers(0, 20))
    last = None if count == 0 else T0
    return TrackMemory(draw(st.integers(0, 100)), draw(stab), last, count)


@given(st.integers(0, 100), stab, days, days)
def test_strength_integer_in_range_and_non_increasing(base, s, d1, d2):
    lo, hi = sorted((d1, d2))
    a, b = strength_at(base, s, lo), strength_at(base, s, hi)
    assert isinstance(a, int) and 0 <= b <= a <= 100


@given(memories(), score_st, days)
def test_review_keeps_stability_in_bounds(mem, score, d):
    out = review(mem, score, T0 + timedelta(days=d))
    assert S_MIN <= out.stability_days <= S_MAX
    assert out.review_count == mem.review_count + 1


@given(stab, st.sampled_from(["skip_interlude", "skip_track", "abandon"]))
def test_penalty_never_raises_stability(s, kind):
    out = apply_penalty(s, kind)
    assert S_MIN <= out <= S_MAX and out <= s


@given(memories(), score_st, score_st, days)
def test_higher_score_never_lowers_stability(mem, a, b, d):
    lo, hi = sorted((a, b))
    now = T0 + timedelta(days=d)
    assert review(mem, lo, now).stability_days <= review(mem, hi, now).stability_days


@given(memories(), st.floats(min_value=0.6, max_value=1, allow_nan=False), days)
def test_passing_score_gives_base_100(mem, score, d):
    assert review(mem, score, T0 + timedelta(days=d)).base_strength == 100


@given(st.integers(0, 100), stab, st.floats(min_value=0, max_value=500, allow_nan=False))
def test_due_matches_next_review_time(base, s, elapsed):
    nxt = next_review_at(T0, base, s)
    boundary = (nxt - T0).total_seconds() / 86400
    if elapsed >= boundary + 1e-6:
        assert is_due(base, s, elapsed)
    elif elapsed <= boundary - 1e-6:
        assert not is_due(base, s, elapsed)


@given(st.integers(0, 100), st.integers(0, 100))
def test_condition_monotonic(a, b):
    lo, hi = sorted((a, b))
    assert CONDITIONS.index(condition(lo)) <= CONDITIONS.index(condition(hi))


@given(strengths)
def test_tape_strength_between_min_and_max(values):
    t = tape_strength(values)
    assert min(values) <= t <= max(values)
    if any(v > 0 for v in values):
        assert t >= 1


@given(strengths)
def test_tape_condition_dead_iff_ghost(values):
    assert (tape_condition(values) == "Dead") == is_ghost(values)


def test_examples():
    assert condition(80) == "Mint" and condition(79) == "Worn"
    assert condition(19) == "Haunted" and condition(0) == "Dead"
    assert tape_strength([]) is None and tape_condition([]) == "Mint"
    assert tape_strength([0, 1]) == 1
    assert st_mod.stability_factor(0.6) == 1.2
