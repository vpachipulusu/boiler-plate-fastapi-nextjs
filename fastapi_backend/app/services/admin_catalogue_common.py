"""Helpers shared by the admin category, merchant and offer services.

Commit contract (same as ``app.services.audit``): a service mutates through its repository,
stages the audit row with ``record`` on the same session and commits once afterwards. Any
refusal raises before the commit, so the request-scoped session rolls everything back.
"""

from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any, Protocol

from sqlalchemy.exc import IntegrityError

from app.core.catalogue_urls import InvalidUrl, validate_https_url
from app.core.permissions import AdminContext
from app.core.slugs import InvalidSlug, slugify, validate_catalogue_slug
from app.services.admin_catalogue_errors import InvalidInput, SlugTaken

MAX_PAGE_SIZE = 100
UNIQUE_VIOLATION = "23505"

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


class AuditRecorder(Protocol):
    async def record(
        self,
        admin: AdminContext,
        *,
        action: str,
        resource: str,
        resource_id: str | None = None,
        organization_id: str | None = None,
        before: object = None,
        after: object = None,
        details: object = None,
    ) -> None: ...


class Committer(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


def clamp_page(limit: int, offset: int) -> tuple[int, int]:
    return min(max(limit, 1), MAX_PAGE_SIZE), max(offset, 0)


def resolve_slug(explicit: str | None, source_text: str) -> str:
    """The slug to store: the editor's own, validated, or one derived from ``source_text``."""
    try:
        return validate_catalogue_slug(explicit) if explicit else slugify(source_text)
    except InvalidSlug:
        raise InvalidInput("invalid_slug") from None


def https_url(value: str) -> str:
    """Validated https URL, or ``InvalidInput('invalid_url')``."""
    try:
        return validate_https_url(value)
    except InvalidUrl:
        raise InvalidInput("invalid_url") from None


def clean_urls(values: Mapping[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    """Copy of ``values`` with each present, non-null URL field validated."""
    cleaned = dict(values)
    for field in fields:
        if cleaned.get(field) is not None:
            cleaned[field] = https_url(cleaned[field])
    return cleaned


def slug_conflict(exc: IntegrityError) -> Exception:
    """``SlugTaken`` for a unique violation; any other integrity error is a bug."""
    orig = exc.orig
    state = getattr(orig, "sqlstate", None) or getattr(
        getattr(orig, "__cause__", None), "sqlstate", None
    )
    return SlugTaken() if state == UNIQUE_VIOLATION else exc


def changed_values(
    current: Any, changes: Mapping[str, Any], audited: frozenset[str]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Before and after values of the changed fields in ``audited``.

    Free text (summaries, notes, step copy) is left out on purpose: the audit row names those
    fields in ``details.fields`` but never stores their content.
    """
    names = [name for name in changes if name in audited]
    before = {name: getattr(current, name) for name in names}
    after = {name: changes[name] for name in names}
    return before, after
