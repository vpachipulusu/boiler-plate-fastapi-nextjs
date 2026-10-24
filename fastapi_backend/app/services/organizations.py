"""Organisations: create, list, read and update.

Authorisation always comes from the ``memberships`` table, read inside the same
transaction as the write and under a row lock, so a membership revoked a moment ago
cannot be used. Nothing about organisation, owner or role is taken from a request body.

Role rules:

* any member reads their organisations;
* OWNER and ADMIN change names;
* only OWNER changes a slug (a slug is the public identity of an organisation);
* creating an organisation makes the caller its OWNER in the same transaction.

A caller who is not a member of an organisation gets ``OrganizationNotFound`` whether
or not it exists. Every sensitive change writes an ``audit_logs`` row in the caller's
transaction, so the change and its audit entry commit or roll back together.
"""

import unicodedata
from dataclasses import dataclass
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.slugs import normalize_slug
from app.models.platform.membership import MembershipRole
from app.repositories.audit import AuditRepository
from app.repositories.organizations import OrganizationRecord, OrganizationsRepository
from app.services.audit import sanitize

MANAGE_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN})
SLUG_ROLES = frozenset({MembershipRole.OWNER})
MAX_NAME_LENGTH = 100
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50
# Abuse guard: organisations one user may own.
MAX_OWNED_ORGANIZATIONS = 10


# Control, format (bidi), line/paragraph separators, surrogates, private use, unassigned.
FORBIDDEN_CATEGORIES = frozenset({"Cc", "Cf", "Zl", "Zp", "Cs", "Co", "Cn"})
# Letters that render as blank (Hangul fillers, braille blank).
INVISIBLE_CHARS = frozenset("ㅤ⠀ﾠᅟᅠ")


class OrganizationNotFound(Exception):
    """No such organisation, or the caller is not a member (404)."""


class OrgForbidden(Exception):
    """A member whose role may not do this (403)."""


class SlugTaken(Exception):
    """The slug is already used (409)."""


class OrganizationLimitReached(Exception):
    """The caller already owns the maximum number of organisations (409)."""


class InvalidName(ValueError):
    """The name is empty, too long or has control characters (422)."""


def normalize_name(raw: str) -> str:
    name = unicodedata.normalize("NFC", raw).strip()
    if not name or len(name) > MAX_NAME_LENGTH:
        raise InvalidName
    if any(unicodedata.category(char) in FORBIDDEN_CATEGORIES for char in name):
        raise InvalidName
    if all(char in INVISIBLE_CHARS or char.isspace() for char in name):
        raise InvalidName
    try:
        name.encode("utf-8")
    except UnicodeEncodeError:
        raise InvalidName from None
    return name


def _slug_conflict(exc: IntegrityError) -> Exception:
    """SlugTaken for a unique violation; anything else is a bug and stays an error."""
    orig = exc.orig
    state = getattr(orig, "sqlstate", None) or getattr(
        getattr(orig, "__cause__", None), "sqlstate", None
    )
    return SlugTaken() if state == "23505" else exc


@dataclass(frozen=True)
class OrganizationView:
    organization: OrganizationRecord
    role: MembershipRole


@dataclass(frozen=True)
class Page[T]:
    items: list[T]
    total: int
    limit: int
    offset: int


class OrganizationsService:
    def __init__(self, store: OrganizationsRepository, session: AsyncSession) -> None:
        self._store = store
        self._session = session
        self._audit = AuditRepository(session)

    # Reads -----------------------------------------------------------------

    async def list_organizations(
        self, user_id: str, limit: int, offset: int
    ) -> Page[OrganizationView]:
        """Only the caller's own organisations, each with their role."""
        rows, total = await self._store.list_for_user(user_id, limit, offset)
        views = [OrganizationView(org, role) for org, role in rows]
        await self._session.rollback()
        return Page(views, total, limit, offset)

    async def get_organization(
        self, organization_id: str, user_id: str
    ) -> OrganizationView:
        role = await self._store.get_role(organization_id, user_id)
        organization = await self._store.get_organization(organization_id)
        if role is None or organization is None:
            raise OrganizationNotFound
        await self._session.rollback()
        return OrganizationView(organization, role)

    # Writes ----------------------------------------------------------------

    async def create_organization(
        self, user_id: str, *, name: str, slug: str, request_id: str | None
    ) -> OrganizationView:
        clean_name = normalize_name(name)
        clean_slug = normalize_slug(slug)
        # Lock the caller's user row so parallel creates cannot all pass the cap.
        await self._store.lock_user(user_id)
        if await self._store.count_owned(user_id) >= MAX_OWNED_ORGANIZATIONS:
            raise OrganizationLimitReached
        organization = await self._store.insert_organization(clean_name, clean_slug)
        if organization is None:
            raise SlugTaken
        await self._store.add_membership(organization.id, user_id, MembershipRole.OWNER)
        await self._record(
            user_id,
            "org.create",
            "organization",
            organization.id,
            organization.id,
            after={
                "name": organization.name,
                "slug": organization.slug,
                "role": MembershipRole.OWNER,
            },
            request_id=request_id,
        )
        await self._session.commit()
        return OrganizationView(organization, MembershipRole.OWNER)

    async def update_organization(
        self,
        organization_id: str,
        user_id: str,
        *,
        name: str | None,
        slug: str | None,
        request_id: str | None,
    ) -> OrganizationView:
        # Membership first (no lock), so a non-member can neither learn the
        # organisation exists nor hold its row lock; then lock and re-read the role.
        await self._require_member(organization_id, user_id, MANAGE_ROLES)
        current = await self._store.get_organization(organization_id, lock=True)
        role = await self._store.get_role(organization_id, user_id)
        if current is None or role is None:
            raise OrganizationNotFound
        values = self._changes(current.name, current.slug, name, slug, role)
        if values:
            try:
                updated = await self._store.update_organization(current.id, values)
            except IntegrityError as exc:
                await self._session.rollback()
                raise _slug_conflict(exc) from None
            await self._record(
                user_id,
                "org.update",
                "organization",
                current.id,
                current.id,
                before={"name": current.name, "slug": current.slug},
                after={"name": updated.name, "slug": updated.slug},
                request_id=request_id,
            )
            await self._session.commit()
            current = updated
        else:
            await self._session.rollback()
        return OrganizationView(current, role)

    # Helpers ---------------------------------------------------------------

    async def _require_member(
        self,
        organization_id: str,
        user_id: str,
        roles: frozenset[MembershipRole],
    ) -> None:
        """Unlocked membership check: 404 for a non-member, 403 for a low role."""
        role = await self._store.get_role(organization_id, user_id)
        if role is None:
            raise OrganizationNotFound
        if role not in roles:
            raise OrgForbidden

    @staticmethod
    def _changes(
        current_name: str,
        current_slug: str,
        name: str | None,
        slug: str | None,
        role: MembershipRole,
    ) -> dict[str, Any]:
        """Validated column changes the role may make; unchanged values are dropped."""
        if role not in MANAGE_ROLES:
            raise OrgForbidden
        values: dict[str, Any] = {}
        if name is not None:
            clean_name = normalize_name(name)
            if clean_name != current_name:
                values["name"] = clean_name
        if slug is not None:
            if role not in SLUG_ROLES:
                raise OrgForbidden
            clean_slug = normalize_slug(slug)
            if clean_slug != current_slug:
                values["slug"] = clean_slug
        return values

    async def _record(
        self,
        user_id: str,
        action: str,
        resource: str,
        resource_id: str,
        organization_id: str,
        *,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        request_id: str | None,
    ) -> None:
        metadata: dict[str, Any] = {}
        for key, value in (
            ("request_id", request_id),
            ("before", before),
            ("after", after),
        ):
            if value is not None:
                metadata[key] = sanitize(value)
        await self._audit.add(
            user_id=user_id,
            organization_id=organization_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            metadata=metadata,
            ip_address=None,
            user_agent=None,
        )
