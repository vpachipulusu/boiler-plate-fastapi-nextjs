"""Admin merchants: create, edit, activate and deactivate.

Slugs are derived from the name unless supplied and cannot change afterwards. ``website`` and
``logo_url`` must be https URLs (``app.core.catalogue_urls``). Activating or deactivating a
merchant that is already in that state is a no-op that stages no audit row. Deactivating does
not unpublish the merchant's offers: the public read API must hide them.
"""

import logging
from collections.abc import Mapping
from typing import Any, Protocol

from sqlalchemy.exc import IntegrityError

from app.core.permissions import AdminContext
from app.repositories.admin_merchants import MerchantPage, MerchantRecord
from app.services.admin_catalogue_common import (
    AuditRecorder,
    Committer,
    changed_values,
    clamp_page,
    clean_urls,
    resolve_slug,
    slug_conflict,
)
from app.services.admin_catalogue_errors import CatalogueNotFound, SlugTaken

__all__ = ["AdminMerchantService"]

EDITABLE_FIELDS = frozenset({"name", "website", "logo_url"})
# The website is audited because it decides where ``direct`` affiliate links may point.
AUDITED_FIELDS = frozenset({"name", "website"})
URL_FIELDS = ("website", "logo_url")
RESOURCE = "merchants"
logger = logging.getLogger("yourapp.admin_catalogue")


class MerchantStore(Protocol):
    async def list_merchants(
        self, search: str | None, active: bool | None, limit: int, offset: int
    ) -> MerchantPage: ...
    async def get(
        self, merchant_id: str, *, lock: bool = False
    ) -> MerchantRecord | None: ...
    async def slug_exists(self, slug: str) -> bool: ...
    async def insert(self, values: dict[str, Any]) -> MerchantRecord: ...
    async def update(
        self, merchant_id: str, values: dict[str, Any]
    ) -> MerchantRecord: ...
    async def active_direct_link_ids(self, merchant_id: str) -> list[str]: ...


class AdminMerchantService:
    def __init__(
        self, store: MerchantStore, session: Committer, auditor: AuditRecorder
    ) -> None:
        self.store, self.session, self.auditor = store, session, auditor

    async def list_merchants(
        self, search: str | None, active: bool | None, limit: int, offset: int
    ) -> MerchantPage:
        return await self.store.list_merchants(
            search, active, *clamp_page(limit, offset)
        )

    async def get_merchant(self, merchant_id: str) -> MerchantRecord:
        found = await self.store.get(merchant_id)
        if found is None:
            raise CatalogueNotFound("merchant")
        return found

    async def create_merchant(
        self, actor: AdminContext, data: Mapping[str, Any]
    ) -> MerchantRecord:
        values = clean_urls(data, URL_FIELDS)
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
            action="admin.merchants.create",
            resource=RESOURCE,
            resource_id=created.id,
            after={
                "name": created.name,
                "slug": created.slug,
                "active": created.active,
                "website": created.website,
            },
        )
        await self.session.commit()
        return created

    async def update_merchant(
        self, actor: AdminContext, merchant_id: str, changes: Mapping[str, Any]
    ) -> MerchantRecord:
        if not changes or not changes.keys() <= EDITABLE_FIELDS:
            raise ValueError("Invalid merchant fields")
        values = clean_urls(changes, URL_FIELDS)
        current = await self._locked(merchant_id)
        updated = await self.store.update(merchant_id, values)
        if "website" in values and values["website"] != current.website:
            await self._warn_about_direct_links(merchant_id)
        before, after = changed_values(current, values, AUDITED_FIELDS)
        await self.auditor.record(
            actor,
            action="admin.merchants.update",
            resource=RESOURCE,
            resource_id=merchant_id,
            before=before,
            after=after,
            details={"fields": sorted(values)},
        )
        await self.session.commit()
        return updated

    async def _warn_about_direct_links(self, merchant_id: str) -> None:
        """`direct` links follow the merchant website, so changing it moves where they may go. Ids only."""
        link_ids = await self.store.active_direct_link_ids(merchant_id)
        if link_ids:
            logger.warning(
                "merchant %s website changed; active direct affiliate links follow it: %s",
                merchant_id,
                ", ".join(link_ids),
            )

    async def set_active(
        self, actor: AdminContext, merchant_id: str, active: bool
    ) -> MerchantRecord:
        current = await self._locked(merchant_id)
        if current.active is active:
            await self.session.rollback()  # release the row lock; nothing changed
            return current
        updated = await self.store.update(merchant_id, {"active": active})
        await self.auditor.record(
            actor,
            action=(
                "admin.merchants.activate" if active else "admin.merchants.deactivate"
            ),
            resource=RESOURCE,
            resource_id=merchant_id,
            before={"active": current.active},
            after={"active": active},
        )
        await self.session.commit()
        return updated

    async def _locked(self, merchant_id: str) -> MerchantRecord:
        found = await self.store.get(merchant_id, lock=True)
        if found is None:
            raise CatalogueNotFound("merchant")
        return found
