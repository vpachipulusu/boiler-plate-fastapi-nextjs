"""ETag and If-None-Match helpers shared by the cacheable public routes."""

import re

import pytest

from app.api.http_cache import etag_for, matches

ETAG = '"abc123"'


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        (None, False),
        (ETAG, True),
        ('W/"abc123"', True),
        ('"other", "abc123"', True),
        ('"other" ,  W/"abc123"  , "third"', True),
        ("*", True),
        ('"other", *', True),
        ('"different"', False),
        ('"abc123x"', False),
        ("", False),
    ],
)
def test_matches_follows_weak_comparison_of_if_none_match(
    header: str | None, expected: bool
) -> None:
    assert matches(header, ETAG) is expected


def test_etag_is_quoted_32_hex_characters() -> None:
    assert re.fullmatch(r'"[0-9a-f]{32}"', etag_for(b"body")) is not None


def test_etag_is_deterministic() -> None:
    assert etag_for(b"same") == etag_for(b"same")


def test_etag_changes_with_the_content() -> None:
    assert etag_for(b"one") != etag_for(b"two")
