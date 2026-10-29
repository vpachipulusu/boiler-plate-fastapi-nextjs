"""CatalogueService: the expiry rule and what each offer status becomes."""

from datetime import timedelta

import pytest

from app.models.platform.offer import OfferStatus
from app.repositories.catalogue import OfferFilters
from app.services.catalogue import CatalogueService, ExpiredOffer, is_live
from tests.fakes_catalogue import (
    NOW,
    FakeCatalogueRepository,
    make_category,
    make_offer,
)


def service_for(repo: FakeCatalogueRepository) -> CatalogueService:
    return CatalogueService(repo, clock=lambda: NOW)


@pytest.mark.parametrize(
    ("status", "end_at", "expected"),
    [
        (OfferStatus.PUBLISHED, None, True),
        (OfferStatus.PUBLISHED, NOW + timedelta(seconds=1), True),
        (OfferStatus.PUBLISHED, NOW, False),
        (OfferStatus.PUBLISHED, NOW - timedelta(days=1), False),
        (OfferStatus.DRAFT, None, False),
        (OfferStatus.ARCHIVED, None, False),
        (OfferStatus.EXPIRED, None, False),
        (OfferStatus.DRAFT, NOW + timedelta(days=1), False),
    ],
)
def test_is_live_is_published_and_not_past_its_end_date(
    status: OfferStatus, end_at: object, expected: bool
) -> None:
    assert is_live(status, end_at, NOW) is expected  # type: ignore[arg-type]


async def test_list_offers_passes_filters_paging_and_the_clock_to_the_repository() -> (
    None
):
    repo = FakeCatalogueRepository(offers=[make_offer()], total=7)
    filters = OfferFilters(query="shampoo")

    page = await service_for(repo).list_offers(filters, limit=5, offset=10)

    assert repo.list_calls == [(filters, NOW, 5, 10)]
    assert page.total == 7
    assert [item.slug for item in page.items] == ["free-shampoo"]


async def test_list_offers_with_nothing_found_is_an_empty_page() -> None:
    page = await service_for(FakeCatalogueRepository()).list_offers(
        OfferFilters(), 12, 0
    )

    assert (page.total, page.items) == (0, [])


async def test_get_offer_returns_a_live_offer() -> None:
    offer = make_offer(end_at=NOW + timedelta(days=2))

    result = await service_for(FakeCatalogueRepository(by_slug=offer)).get_offer("x")

    assert result == offer


async def test_get_offer_is_none_for_an_unknown_slug() -> None:
    repo = FakeCatalogueRepository()

    assert await service_for(repo).get_offer("nope") is None
    assert repo.slugs == ["nope"]


@pytest.mark.parametrize("status", [OfferStatus.DRAFT, OfferStatus.ARCHIVED])
async def test_get_offer_hides_unpublished_offers_like_unknown_ones(
    status: OfferStatus,
) -> None:
    repo = FakeCatalogueRepository(by_slug=make_offer(status=status))

    assert await service_for(repo).get_offer("free-shampoo") is None


@pytest.mark.parametrize(
    ("status", "end_at"),
    [
        (OfferStatus.PUBLISHED, NOW - timedelta(hours=1)),
        (OfferStatus.PUBLISHED, NOW),
        (OfferStatus.EXPIRED, None),
    ],
)
async def test_get_offer_reports_an_ended_offer_as_expired(
    status: OfferStatus, end_at: object
) -> None:
    offer = make_offer(status=status, end_at=end_at)

    result = await service_for(FakeCatalogueRepository(by_slug=offer)).get_offer("x")

    assert result == ExpiredOffer(
        slug="free-shampoo",
        title="Free shampoo sample",
        category_slug="beauty",
        category_name="Beauty",
        ended_at=end_at,  # type: ignore[arg-type]
    )


async def test_list_categories_asks_with_the_current_time() -> None:
    repo = FakeCatalogueRepository(categories=[make_category()])

    result = await service_for(repo).list_categories()

    assert [c.slug for c in result] == ["beauty"]
    assert repo.category_now == [NOW]


async def test_default_clock_is_timezone_aware() -> None:
    repo = FakeCatalogueRepository()

    await CatalogueService(repo).list_categories()

    assert repo.category_now[0].tzinfo is not None


@pytest.mark.parametrize("status", [OfferStatus.EXPIRED, OfferStatus.DRAFT])
async def test_expired_offer_without_verification_is_treated_as_unknown(
    status: OfferStatus,
) -> None:
    offer = make_offer(
        status=status, end_at=NOW - timedelta(days=1), last_verified_at=None
    )

    result = await service_for(FakeCatalogueRepository(by_slug=offer)).get_offer("x")

    assert result is None


async def test_expired_offer_with_a_future_end_date_reports_no_end_date() -> None:
    offer = make_offer(status=OfferStatus.EXPIRED, end_at=NOW + timedelta(days=3))

    result = await service_for(FakeCatalogueRepository(by_slug=offer)).get_offer("x")

    assert isinstance(result, ExpiredOffer)
    assert result.ended_at is None


async def test_published_offer_ended_in_the_past_keeps_its_end_date() -> None:
    ended = NOW - timedelta(hours=2)
    offer = make_offer(end_at=ended)

    result = await service_for(FakeCatalogueRepository(by_slug=offer)).get_offer("x")

    assert isinstance(result, ExpiredOffer)
    assert result.ended_at == ended
