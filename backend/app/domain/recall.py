"""Recall scoring. Pure functions, no I/O."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

_NON_WORD = re.compile(r"[\W_]+")


@dataclass(frozen=True)
class RecallScore:
    score: float
    matched: tuple[str, ...]
    missed: tuple[str, ...]


def normalize(text: str) -> str:
    """Lowercase, turn punctuation into spaces, collapse runs of spaces."""
    return _NON_WORD.sub(" ", text.lower()).strip()


def score(key_terms: Sequence[str], text: str) -> RecallScore:
    """Fraction of key terms found in text as whole words or phrases.

    The last word of a term may take a simple plural suffix ("s" or "es"), so
    "cell" matches "cells" but not "cellular" or "excellent".

    Terms are deduplicated by normalised form (each counts once). Terms that
    normalise to nothing are ignored. Score is 0 with no terms or no text.
    """
    haystack = f" {normalize(text)} "
    seen: set[str] = set()
    matched: list[str] = []
    missed: list[str] = []
    for term in key_terms:
        norm = normalize(term)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        if re.search(rf" {re.escape(norm)}(?:e?s)? ", haystack):
            matched.append(term)
        else:
            missed.append(term)
    total = len(matched) + len(missed)
    value = len(matched) / total if total else 0.0
    return RecallScore(value, tuple(matched), tuple(missed))
