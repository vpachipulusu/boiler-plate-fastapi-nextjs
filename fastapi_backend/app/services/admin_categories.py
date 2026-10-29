"""Admin categories: create, edit, enable and disable.

Slugs are derived from the name unless supplied and cannot change afterwards (public URLs
depend on them). Enabling or disabling an already-matching category is a no-op: nothing is
written, so no audit row is staged. Disabling does not unpublish the category's offers: the
public read API must hide offers of a disabled category.
"""

from collections.abc import Mapping
from typing import Any, Protocol

from sqlalchemy.exc import IntegrityError

from app.core.permissions import AdminContext
from app.repositories.admin_categories import CategoryPage, CategoryRecord
from app.services.admin_catalogue_common import (
    AuditRecorder,
    Committer,
    changed_values,
    clamp_page,
    resolve_slug,
    slug_conflict,
)
from app.services.admin_catalogue_errors import CatalogueNotFound, SlugTaken

__all__ = ["AdminCategoryService"]

EDITABLE_FIELDS = frozenset(
    {"name", "short_name", "description", "intro", "tint", "sort_order"}
)
AUDITED_FIELDS = frozenset({"name", "tint", "sort_order"})
RESOURCE = "categories"


class CategoryStore(Protocol):
    async def list_categories(
        self, search: str | None, enabled: bool | None, limit: int, offset: int
    ) -> CategoryPage: ...
    async def get(
        self, category_id: str, *, lock: bool = False
    ) -> CategoryRecord | None: ...
    async def slug_exists(self, slug: str) -> bool: ...
    async def insert(self, values: dict[str, Any]) -> CategoryRecord: ...
    async def update(
        self, category_id: str, values: dict[str, Any]
    ) -> CategoryRecord: ...


class AdminCategoryService:
    def __init__(
        self, store: CategoryStore, session: Committer, auditor: AuditRecorder
    ) -> None:
        self.store, self.session, self.auditor = store, session, auditor

    async def list_categories(
        self, search: str | None, enabled: bool | None, limit: int, offset: int
    ) -> CategoryPage:
        return await self.store.list_categories(
            search, enabled, *clamp_page(limit, offset)
        )

    async def get_category(self, category_id: str) -> CategoryRecord:
        found = await self.store.get(category_id)
        if found is None:
            raise CatalogueNotFound("category")
        return found

    async def create_category(
        self, actor: AdminContext, data: Mapping[str, Any]
    ) -> CategoryRecord:
        values = dict(data)
        slug = resolve_slug(values.pop("slug", None), values["name"])
        if await self.store.slug_exists(slug):
            raise SlugTaken()
        try:
            created = await self.store.insert({**values, "slug": slug})
        except IntegrityError as exc:
            await self.session.rollback()
            raise slug_conflict(exc) from None
        await self.auditor.record(
            actor,
            action="admin.categories.create",
            resource=RESOURCE,
            resource_id=created.id,
            after={
                "name": created.name,
                "slug": created.slug,
                "enabled": created.enabled,
            },
        )
        await self.session.commit()
        return created

    async def update_category(
        self, actor: AdminContext, category_id: str, changes: Mapping[str, Any]
    ) -> CategoryRecord:
        if not changes or not changes.keys() <= EDITABLE_FIELDS:
            raise ValueError("Invalid category fields")
        current = await self._locked(category_id)
        updated = await self.store.update(category_id, dict(changes))
        before, after = changed_values(current, changes, AUDITED_FIELDS)
        await self.auditor.record(
            actor,
            action="admin.categories.update",
            resource=RESOURCE,
            resource_id=category_id,
            before=before,
            after=after,
            details={"fields": sorted(changes)},
        )
        await self.session.commit()
        return updated

    async def set_enabled(
        self, actor: AdminContext, category_id: str, enabled: bool
    ) -> CategoryRecord:
        current = await self._locked(category_id)
        if current.enabled is enabled:
            await self.session.rollback()  # release the row lock; nothing changed
            return current
        updated = await self.store.update(category_id, {"enabled": enabled})
        await self.auditor.record(
            actor,
            action="admin.categories.enable" if enabled else "admin.categories.disable",
            resource=RESOURCE,
            resource_id=category_id,
            before={"enabled": current.enabled},
            after={"enabled": enabled},
        )
        await self.session.commit()
        return updated

    async def _locked(self, category_id: str) -> CategoryRecord:
        found = await self.store.get(category_id, lock=True)
        if found is None:
            raise CatalogueNotFound("category")
        return found
