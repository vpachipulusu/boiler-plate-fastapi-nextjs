"""Conditional-request helpers shared by the cacheable public routes (ETag, If-None-Match)."""

import hashlib


def etag_for(body: bytes) -> str:
    """A strong ETag: a content hash of the response body."""
    return f'"{hashlib.sha256(body).hexdigest()[:32]}"'


def matches(if_none_match: str | None, etag: str) -> bool:
    """RFC 9110 weak comparison of an ``If-None-Match`` list against ``etag``."""
    if if_none_match is None:
        return False
    candidates = [part.strip() for part in if_none_match.split(",")]
    return "*" in candidates or any(c.removeprefix("W/") == etag for c in candidates)
