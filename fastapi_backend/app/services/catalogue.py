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

    async def find_visible_offer_by_id(self, offer_id: str) -> OfferRecord | None: ...

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


def _was_public(offer: OfferRecord) -> bool:
    """Not live now, but it was: ended while published, or retired after being verified."""
    if offer.status is OfferStatus.PUBLISHED:
        return True
    return offer.status is OfferStatus.EXPIRED and offer.last_verified_at is not None


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

        Only an offer that provably was public can be reported as ended: published with an
        end date that has passed, or marked EXPIRED with a verification date (a published
        offer always has one, so its absence means the offer never went live). Drafts,
        archived offers, EXPIRED rows that never went live and unknown slugs all answer
        None, so a visitor cannot probe for unpublished content.
        """
        now = self._clock()
        return self._as_public(await self._repository.find_visible_offer(slug), now)

    async def get_offer_by_id(self, offer_id: str) -> OfferRecord | ExpiredOffer | None:
        """``get_offer`` for a caller that holds the offer id (the outbound redirect).

        Same rule, same answers: unknown, draft, archived and never-live offers are None.
        """
        now = self._clock()
        return self._as_public(
            await self._repository.find_visible_offer_by_id(offer_id), now
        )

    @staticmethod
    def _as_public(
        offer: OfferRecord | None, now: datetime
    ) -> OfferRecord | ExpiredOffer | None:
        if offer is None:
            return None
        if is_live(offer.status, offer.end_at, now):
            return offer
        if not _was_public(offer):
            return None
        ended_at = offer.end_at
        return ExpiredOffer(
            slug=offer.slug,
            title=offer.title,
            category_slug=offer.category_slug,
            category_name=offer.category_name,
            ended_at=ended_at if ended_at is not None and ended_at <= now else None,
        )

    async def list_categories(self) -> Sequence[CategoryRecord]:
        """Enabled categories, each with its count of live offers."""
        return await self._repository.list_enabled_categories(self._clock())
