"""Queries behind the admin merchants API. No business rules live here."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select

from app.models.platform.merchant import Merchant
from app.repositories.base import BaseRepository
from app.repositories.catalogue import escape_like


@dataclass(frozen=True)
class MerchantRecord:
    id: str
    name: str
    slug: str
    website: str | None
    logo_url: str | None
    active: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class MerchantPage:
    merchants: list[MerchantRecord]
    total_count: int


def _record(row: Merchant) -> MerchantRecord:
    return MerchantRecord(
        id=row.id,
        name=row.name,
        slug=row.slug,
        website=row.website,
        logo_url=row.logo_url,
        active=row.active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class AdminMerchantRepository(BaseRepository):
    async def list_merchants(
        self, search: str | None, active: bool | None, limit: int, offset: int
    ) -> MerchantPage:
        conditions: list[Any] = []
        if search:
            pattern = f"%{escape_like(search)}%"
            conditions.append(
                Merchant.name.ilike(pattern, escape="\\")
                | Merchant.slug.ilike(pattern, escape="\\")
            )
        if active is not None:
            conditions.append(Merchant.active.is_(active))
        rows = await self._session.scalars(
            select(Merchant)
            .where(*conditions)
            .order_by(Merchant.name, Merchant.id)
            .limit(limit)
            .offset(offset)
        )
        total = await self._session.scalar(
            select(func.count()).select_from(Merchant).where(*conditions)
        )
        return MerchantPage([_record(row) for row in rows], total or 0)

    async def get(
        self, merchant_id: str, *, lock: bool = False
    ) -> MerchantRecord | None:
        row = await self._session.get(Merchant, merchant_id, with_for_update=lock)
        return _record(row) if row else None

    async def slug_exists(self, slug: str) -> bool:
        found = await self._session.scalar(
            select(Merchant.id).where(Merchant.slug == slug)
        )
        return found is not None

    async def insert(self, values: dict[str, Any]) -> MerchantRecord:
        row = Merchant(**values)
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _record(row)

    async def update(self, merchant_id: str, values: dict[str, Any]) -> MerchantRecord:
        row = await self._session.get(Merchant, merchant_id)
        if row is None:  # pragma: no cover - the caller holds the row lock
            raise LookupError(merchant_id)
        for field, value in values.items():
            setattr(row, field, value)
        await self._session.flush()
        await self._session.refresh(row)
        return _record(row)
