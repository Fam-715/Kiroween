from datetime import UTC, datetime, timedelta

from hypothesis import given
from hypothesis import strategies as st

from app.domain import strength
from app.domain.sample import sample_tape
from app.domain.schedule import validate_tape

# Virtual now can be any moment, including far-warped times.
nows = st.datetimes(
    min_value=datetime(2001, 1, 1), max_value=datetime(2200, 1, 1), timezones=st.just(UTC)
)


def _states(now: datetime) -> list[tuple[int, str, bool]]:
    out = []
    for t in sample_tape(now).tracks:
        m = t.memory
        elapsed = (now - m.last_reviewed_at).total_seconds() / 86400
        value = strength.strength_at(m.base_strength, m.stability_days, elapsed)
        due = strength.is_due(m.base_strength, m.stability_days, elapsed)
        out.append((value, strength.condition(value), due))
    return out


@given(nows)
def test_sample_is_valid_without_demo_mode(now: datetime) -> None:
    """**Validates: Requirements 12.9, 12.10**"""
    spec = sample_tape(now)
    assert spec.is_sample
    assert validate_tape(spec.as_tape(), False, set()) == []


@given(nows)
def test_sample_is_deterministic(now: datetime) -> None:
    """**Validates: Requirements 12.9**"""
    assert sample_tape(now) == sample_tape(now)


@given(nows)
def test_one_track_in_each_condition_and_worn_is_due(now: datetime) -> None:
    """**Validates: Requirements 12.9, 12.10**"""
    states = _states(now)
    assert sorted(c for _, c, _ in states) == ["Haunted", "Mint", "Warped", "Worn"]
    by_cond = {c: (v, due) for v, c, due in states}
    assert by_cond["Worn"][1] is True
    assert by_cond["Mint"][1] is False
    assert [v for v, _, _ in states] == [90, 67, 29, 8]


@given(nows, st.integers(min_value=0, max_value=3))
def test_seeded_score_matches_terms_and_age(now: datetime, idx: int) -> None:
    """**Validates: Requirements 12.9**"""
    t = sample_tape(now).tracks[idx]
    assert len(t.memory.matched_terms) + len(t.memory.missed_terms) == len(t.item.key_terms or ())
    assert t.memory.score == len(t.memory.matched_terms) / len(t.item.key_terms or ())
    assert t.memory.last_reviewed_at < now
    assert now - t.memory.last_reviewed_at <= timedelta(days=3)
