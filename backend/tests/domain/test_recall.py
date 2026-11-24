"""Property tests for domain/recall.py.

**Validates: Requirements 5.11**
"""

from __future__ import annotations

from hypothesis import given, strategies as st

from app.domain.recall import normalize, score

word = st.text(alphabet="abcdefghij", min_size=1, max_size=6)
term = st.lists(word, min_size=1, max_size=3).map(" ".join)
terms = st.lists(term, min_size=0, max_size=6)
text = st.text(alphabet="abcdefghij ,.!-", max_size=60)


@given(terms, text)
def test_score_in_range_and_ratio(ts, tx):
    r = score(ts, tx)
    assert 0.0 <= r.score <= 1.0
    total = len(r.matched) + len(r.missed)
    assert r.score == (len(r.matched) / total if total else 0.0)


@given(terms, text)
def test_case_insensitive(ts, tx):
    assert score(ts, tx) == score(ts, tx.upper())


@given(terms, text, text)
def test_appending_text_never_lowers(ts, a, b):
    assert score(ts, a + " " + b).score >= score(ts, a).score


@given(terms)
def test_empty_text_scores_zero(ts):
    assert score(ts, "").score == 0.0


@given(st.lists(term, min_size=1, max_size=6), st.sampled_from([" ", ", ", ". "]))
def test_all_terms_present_scores_one(ts, sep):
    assert score(ts, sep.join(ts)).score == 1.0


def test_cell_does_not_match_excellent():
    assert score(["cell"], "an excellent result").score == 0.0
    assert score(["cell"], "the Cell, divides").score == 1.0


@given(word, st.sampled_from(["s", "es"]))
def test_plural_of_single_word_term_still_matches(w, suffix):
    assert score([w], f"we saw {w}{suffix} here").score == 1.0


def test_simple_plurals_match():
    assert score(["cell"], "many cells").score == 1.0
    assert score(["process"], "two processes").score == 1.0
    assert score(["cell wall"], "the cell walls").score == 1.0


def test_cell_does_not_match_cellular_or_excellent():
    assert score(["cell"], "cellular biology").score == 0.0
    assert score(["cell"], "excellent").score == 0.0
    assert score(["cell"], "excellents").score == 0.0


def test_phrase_must_appear_whole():
    assert score(["cell wall"], "cell and wall").score == 0.0
    assert score(["cell wall"], "the cell wall.").score == 1.0


def test_normalize():
    assert normalize("  Hello,   World!! ") == "hello world"
