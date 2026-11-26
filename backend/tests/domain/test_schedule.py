"""Property tests for app.domain.schedule (Requirements 2.2-2.5, 2.7, 12.2, 12.3)."""

from __future__ import annotations

from dataclasses import replace

from hypothesis import given, strategies as st

from app.domain.schedule import (
    INTERLUDE_MAX_MINUTES,
    INTERLUDE_MIN_MINUTES,
    KEY_TERMS_MAX,
    KEY_TERMS_MIN,
    TAPE_LENGTHS,
    TRACK_MAX_MINUTES,
    TRACK_MIN_MINUTES,
    TRACK_MIN_MINUTES_DEMO,
    Item,
    Tape,
    min_track_minutes,
    remaining_minutes,
    side_capacity,
    side_total,
    validate_side,
    validate_tape,
)

lengths = st.sampled_from(TAPE_LENGTHS)
words = st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=12)


@st.composite
def key_term_lists(draw, n=None):
    count = n if n is not None else draw(st.integers(KEY_TERMS_MIN, KEY_TERMS_MAX))
    terms = draw(st.lists(words, min_size=count, max_size=count, unique_by=str.casefold))
    return tuple(terms)


@st.composite
def tracks(draw, min_minutes=TRACK_MIN_MINUTES):
    return Item(
        kind="track",
        minutes=draw(st.integers(min_minutes, TRACK_MAX_MINUTES)),
        id=draw(st.uuids().map(str)),
        name=draw(words),
        key_terms=draw(key_term_lists()),
    )


interludes = st.builds(
    Item,
    kind=st.just("interlude"),
    minutes=st.integers(INTERLUDE_MIN_MINUTES, INTERLUDE_MAX_MINUTES),
)


@st.composite
def valid_sides(draw, length):
    """A side with no adjacent tracks, each item valid, total within capacity."""
    cap = side_capacity(length)
    items: list[Item] = []
    total = 0
    for _ in range(draw(st.integers(0, 8))):
        prev_track = bool(items) and items[-1].kind == "track"
        item = draw(interludes if prev_track else st.one_of(tracks(), interludes))
        if total + item.minutes > cap:
            break
        items.append(item)
        total += item.minutes
    return items


@st.composite
def valid_tapes(draw):
    length = draw(lengths)
    return Tape(
        title=draw(st.text(min_size=1, max_size=60).filter(lambda s: s.strip())),
        length=length,
        side_a=draw(valid_sides(length)),
        side_b=draw(valid_sides(length)),
    )


def rules(violations):
    return {v.rule for v in violations}


def test_capacities():
    assert [side_capacity(x) for x in ("C60", "C90", "C120")] == [30, 45, 60]
    assert min_track_minutes(False) == 10
    assert min_track_minutes(True) == 1


def has_track(tape: Tape) -> bool:
    return any(i.kind == "track" for i in (*tape.side_a, *tape.side_b))


# **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.9**
@given(valid_tapes(), st.booleans())
def test_random_valid_tapes_pass(tape, demo):
    # A tape without any track is invalid (2.9); every other generated tape is valid.
    expected = [] if has_track(tape) else ["no_tracks"]
    assert [v.rule for v in validate_tape(tape, demo)] == expected


# **Validates: Requirements 2.9**
@given(lengths, st.lists(interludes, max_size=3), st.lists(interludes, max_size=3), st.booleans())
def test_tape_without_tracks_is_rejected(length, side_a, side_b, demo):
    violations = validate_tape(Tape("T", length, side_a, side_b), demo)
    no_tracks = [v for v in violations if v.rule == "no_tracks"]
    assert len(no_tracks) == 1
    assert no_tracks[0].side is None
    assert no_tracks[0].message == "Add at least one track."


# **Validates: Requirements 2.4**
@given(st.data(), lengths)
def test_adding_item_over_capacity_fails(data, length):
    side = data.draw(valid_sides(length))
    extra = remaining_minutes(side, length) + data.draw(st.integers(1, 20))
    over = Item(kind="interlude", minutes=extra)
    assert "capacity" in rules(validate_side([*side, over], False, length=length))


# **Validates: Requirements 2.4, 2.7**
@given(st.data(), lengths)
def test_remaining_equals_capacity_minus_total(data, length):
    side = data.draw(valid_sides(length))
    assert remaining_minutes(side, length) == side_capacity(length) - side_total(side)
    assert remaining_minutes(side, length) >= 0


# **Validates: Requirements 2.5**
@given(lengths, st.data())
def test_cross_side_tracks_are_not_adjacent(length, data):
    a = data.draw(tracks())
    b = data.draw(tracks())
    tape = Tape("T", length, [a], [b])
    assert "adjacent_tracks" not in rules(validate_tape(tape, False))
    # Two tracks on one side are adjacent.
    assert "adjacent_tracks" in rules(validate_side([a, b], False, length="C120"))


# **Validates: Requirements 2.2**
@given(tracks(), st.data())
def test_wrong_key_term_count_or_case_duplicates_rejected(track, data):
    few = replace(track, key_terms=data.draw(key_term_lists(2)))
    many = replace(track, key_terms=data.draw(key_term_lists(6)))
    assert "key_terms_count" in rules(validate_side([few], False, length="C120"))
    assert "key_terms_count" in rules(validate_side([many], False, length="C120"))

    terms = list(track.key_terms)
    terms[1] = terms[0].upper()
    dup = replace(track, key_terms=tuple(terms))
    assert "key_terms_unique" in rules(validate_side([dup], False, length="C120"))


# **Validates: Requirements 2.2, 12.2**
@given(tracks(min_minutes=TRACK_MIN_MINUTES_DEMO), st.booleans())
def test_track_minimum_follows_demo_mode(track, demo):
    ok = "track_minutes" not in rules(validate_side([track], demo, length="C120"))
    assert ok == (track.minutes >= min_track_minutes(demo))


# **Validates: Requirements 12.3**
@given(tracks(min_minutes=TRACK_MIN_MINUTES_DEMO))
def test_unchanged_short_tracks_stay_valid_after_demo_off(track):
    saved = {track.id}
    # Unchanged: exempt from the 10-minute minimum with Demo mode off.
    assert "track_minutes" not in rules(
        validate_side([track], False, saved, length="C120")
    )
    if track.minutes < TRACK_MIN_MINUTES:
        # New (different id) or changed (not in unchanged_ids) short tracks fail.
        assert "track_minutes" in rules(validate_side([track], False, length="C120"))
        other = replace(track, id="new-id")
        assert "track_minutes" in rules(validate_side([other], False, saved, length="C120"))


def test_tape_title_and_length_rules():
    assert "title" in rules(validate_tape(Tape("", "C60", [], []), False))
    assert "title" in rules(validate_tape(Tape("x" * 61, "C60", [], []), False))
    assert "length" in rules(validate_tape(Tape("ok", "C30", [], []), False))
