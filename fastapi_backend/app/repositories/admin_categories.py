"""Queries behind the admin categories API. No business rules live here."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select

from app.models.platform.category import Category
from app.repositories.base import BaseRepository
from app.repositories.catalogue import escape_like


@dataclass(frozen=True)
class CategoryRecord:
    id: str
    name: str
    slug: str
    short_name: str
    description: str
    intro: str
    tint: str
    sort_order: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class CategoryPage:
    categories: list[CategoryRecord]
    total_count: int


def _record(row: Category) -> CategoryRecord:
    return CategoryRecord(
        id=row.id,
        name=row.name,
        slug=row.slug,
        short_name=row.short_name,
        description=row.description,
        intro=row.intro,
        tint=row.tint,
        sort_order=row.sort_order,
        enabled=row.enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class AdminCategoryRepository(BaseRepository):
    async def list_categories(
        self, search: str | None, enabled: bool | None, limit: int, offset: int
    ) -> CategoryPage:
        conditions: list[Any] = []
        if search:
            pattern = f"%{escape_like(search)}%"
            conditions.append(
                Category.name.ilike(pattern, escape="\\")
                | Category.slug.ilike(pattern, escape="\\")
            )
        if enabled is not None:
            conditions.append(Category.enabled.is_(enabled))
        rows = await self._session.scalars(
            select(Category)
            .where(*conditions)
            .order_by(Category.sort_order, Category.name, Category.id)
            .limit(limit)
            .offset(offset)
        )
        total = await self._session.scalar(
            select(func.count()).select_from(Category).where(*conditions)
        )
        return CategoryPage([_record(row) for row in rows], total or 0)

    async def get(
        self, category_id: str, *, lock: bool = False
    ) -> CategoryRecord | None:
        row = await self._session.get(Category, category_id, with_for_update=lock)
        return _record(row) if row else None

    async def slug_exists(self, slug: str) -> bool:
        found = await self._session.scalar(
            select(Category.id).where(Category.slug == slug)
        )
        return found is not None

    async def insert(self, values: dict[str, Any]) -> CategoryRecord:
        row = Category(**values)
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _record(row)

    async def update(self, category_id: str, values: dict[str, Any]) -> CategoryRecord:
        row = await self._session.get(Category, category_id)
        if row is None:  # pragma: no cover - the caller holds the row lock
            raise LookupError(category_id)
        for field, value in values.items():
            setattr(row, field, value)
        await self._session.flush()
        await self._session.refresh(row)
        return _record(row)
