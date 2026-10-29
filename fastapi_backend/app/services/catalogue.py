"""Public catalogue reads: which offers the site may show, and what an ended offer becomes."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.models.platform.offer import OfferStatus
from app.repositories.catalogue import CategoryRecord, OfferFilters, OfferRecord


class CatalogueReader(Protocol):
    async def list_live_offers(
        self, filters: OfferFilters, now: datetime, limit: int, offset: int
    ) -> tuple[int, list[OfferRecord]]: ...

    async def find_visible_offer(self, slug: str) -> OfferRecord | None: ...

    async def list_enabled_categories(
        self, now: datetime
    ) -> Sequence[CategoryRecord]: ...


@dataclass(frozen=True)
class ExpiredOffer:
    """What the public learns about an offer that has ended: enough to say so and move on."""

    slug: str
    title: str
    category_slug: str
    category_name: str
    ended_at: datetime | None


@dataclass(frozen=True)
class OfferPage:
    total: int
    items: list[OfferRecord]


def is_live(status: OfferStatus, end_at: datetime | None, now: datetime) -> bool:
    """The expiry rule: published, and either open-ended or ending in the future.

    ``repositories.catalogue.live_conditions`` is the same rule as SQL; keep them equal.
    """
    return status is OfferStatus.PUBLISHED and (end_at is None or end_at > now)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CatalogueService:
    def __init__(
        self,
        repository: CatalogueReader,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._repository = repository
        self._clock = clock

    async def list_offers(
        self, filters: OfferFilters, limit: int, offset: int
    ) -> OfferPage:
        """Live offers matching ``filters``, with the total before paging."""
        total, items = await self._repository.list_live_offers(
            filters, self._clock(), limit, offset
        )
        return OfferPage(total=total, items=items)

    async def get_offer(self, slug: str) -> OfferRecord | ExpiredOffer | None:
        """The live offer, an ``ExpiredOffer`` once it has ended, or None.

        Drafts and archived offers answer None, exactly like a slug that does not exist, so
        a visitor cannot probe for unpublished content. An offer an editor marked EXPIRED, or
        a published one whose end date has passed, answers ``ExpiredOffer``.
        """
        offer = await self._repository.find_visible_offer(slug)
        if offer is None:
            return None
        if is_live(offer.status, offer.end_at, self._clock()):
            return offer
        if offer.status in (OfferStatus.PUBLISHED, OfferStatus.EXPIRED):
            return ExpiredOffer(
                slug=offer.slug,
                title=offer.title,
                category_slug=offer.category_slug,
                category_name=offer.category_name,
                ended_at=offer.end_at,
            )
        return None

    async def list_categories(self) -> Sequence[CategoryRecord]:
        """Enabled categories, each with its count of live offers."""
        return await self._repository.list_enabled_categories(self._clock())
