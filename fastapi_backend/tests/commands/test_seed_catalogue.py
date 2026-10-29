"""``commands.seed_catalogue``: the environment guard, the sample data and idempotency.

The guard and data tests need no database. The upsert tests run against the throwaway database
named by ``TEST_DATABASE_URL`` (a local ``*_test`` database, one per xdist worker) and are skipped
without it, like the ``*_e2e.py`` suites; CI provides one.
"""

import asyncio
import os
import re
import subprocess
import sys
from collections.abc import Awaitable, Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import func, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.core.config as config_module
from app.core.database import build_engine
from app.models.platform import (
    AffiliateLink,
    Category,
    Merchant,
    Offer,
    OfferStatus,
    OfferType,
    PostageKind,
)
from commands import seed_catalogue
from commands.seed_data import (
    CATEGORIES,
    MERCHANTS,
    SAMPLE_NOTE,
    SAMPLE_ORIGIN,
    steps_for,
)
from commands.seed_data_offers import OFFERS

BACKEND_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_TS = (
    BACKEND_ROOT.parent
    / "nextjs-frontend"
    / "src"
    / "lib"
    / "catalogue"
    / "fixtures.ts"
)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
TODAY = date(2026, 10, 29)

needs_database = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="TEST_DATABASE_URL is not set"
)


class ForbiddenMaker:
    """A session maker that fails the test if the command ever reaches the database."""

    def __call__(self) -> Any:
        raise AssertionError("the database must not be opened")


class LeakyMaker:
    """A session maker whose failure message carries a connection string."""

    def __call__(self) -> Any:
        raise RuntimeError("postgresql://user:hunter2@db.example.invalid/prod")


# --- environment guard ------------------------------------------------------------------------


@pytest.mark.parametrize(
    "environment",
    [
        "production",
        "staging",
        "preview",
        "development",
        "",
        "Local",
        " test",
        "TEST",
        "local ",
    ],
)
def test_refuses_to_run_outside_local_and_test(
    environment: str, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code = seed_catalogue.main(environment=environment, maker=ForbiddenMaker())

    output = capsys.readouterr().out
    assert exit_code == 1
    assert "refusing to run" in output
    assert "Nothing was written" in output


@pytest.mark.parametrize("environment", ["local", "test"])
def test_allows_exactly_local_and_test(environment: str) -> None:
    assert seed_catalogue.is_seed_allowed(environment)


def test_unknown_environment_is_not_allowed() -> None:
    assert not seed_catalogue.is_seed_allowed(None)
    assert not seed_catalogue.is_seed_allowed("")


def test_reads_the_environment_from_settings_when_not_given(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        config_module, "settings", SimpleNamespace(ENVIRONMENT="production")
    )

    exit_code = seed_catalogue.main(maker=ForbiddenMaker())

    assert exit_code == 1
    assert "refusing to run" in capsys.readouterr().out


def test_refuses_when_settings_cannot_be_loaded(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delattr(config_module, "settings")

    exit_code = seed_catalogue.main(maker=ForbiddenMaker())

    assert exit_code == 1
    assert "refusing to run" in capsys.readouterr().out


def test_refusal_never_prints_the_connection_string(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    secret = "postgresql+asyncpg://user:hunter2@db.example.invalid/prod"
    monkeypatch.setattr(
        config_module,
        "settings",
        SimpleNamespace(ENVIRONMENT="production", DATABASE_URL=secret),
    )

    seed_catalogue.main(maker=ForbiddenMaker())

    output = capsys.readouterr().out
    assert "hunter2" not in output
    assert "postgresql" not in output


def test_takes_no_command_line_arguments(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = seed_catalogue.main(
        environment="local", maker=ForbiddenMaker(), argv=["--force"]
    )

    assert exit_code == 2
    assert "no arguments" in capsys.readouterr().out


def test_reports_only_the_error_type_when_the_database_fails(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = seed_catalogue.main(environment="test", maker=LeakyMaker())

    output = capsys.readouterr().out
    assert exit_code == 1
    assert "RuntimeError" in output
    assert "hunter2" not in output
    assert "db.example.invalid" not in output


# --- sample data ------------------------------------------------------------------------------


def test_seeds_the_phase_1_fixture_counts() -> None:
    assert len(CATEGORIES) == 6
    assert len(MERCHANTS) == 8
    assert len(OFFERS) == 24


def test_slugs_match_the_frontend_fixtures() -> None:
    if not FIXTURES_TS.exists():
        pytest.skip("the frontend fixtures are not checked out")
    fixture_slugs = set(re.findall(r"slug: '([^']+)'", FIXTURES_TS.read_text("utf-8")))
    seeded = (
        {c.slug for c in CATEGORIES}
        | {m.slug for m in MERCHANTS}
        | {o.slug for o in OFFERS}
    )
    assert seeded == fixture_slugs


def test_slugs_are_unique_per_kind() -> None:
    for seeds in (CATEGORIES, MERCHANTS, OFFERS):
        slugs = [seed.slug for seed in seeds]
        assert len(slugs) == len(set(slugs))


def test_every_offer_points_at_a_seeded_category_and_merchant() -> None:
    categories = {c.slug for c in CATEGORIES}
    merchants = {m.slug for m in MERCHANTS}
    assert all(o.category_slug in categories for o in OFFERS)
    assert all(o.merchant_slug in merchants for o in OFFERS)


def test_every_offer_type_and_status_is_represented() -> None:
    assert {o.offer_type for o in OFFERS} == set(OfferType)
    assert {o.status for o in OFFERS} == set(OfferStatus)


def test_merchant_names_are_marked_as_fictional_samples() -> None:
    assert all(m.name.endswith(" (Sample)") for m in MERCHANTS)


def test_published_offers_have_a_verification_date_not_in_the_future() -> None:
    published = [o for o in OFFERS if o.status is OfferStatus.PUBLISHED]
    assert published
    assert all(o.verified_days <= 0 for o in published)


def test_postage_follows_the_database_rule() -> None:
    for offer in OFFERS:
        if offer.postage_kind is PostageKind.COST:
            assert offer.postage_amount_minor is not None
            assert offer.postage_amount_minor >= 0
            assert offer.postage_currency is not None
            assert re.fullmatch(r"[A-Z]{3}", offer.postage_currency)
        else:
            assert offer.postage_amount_minor is None
            assert offer.postage_currency is None


def test_ended_offers_have_ended_and_live_offers_have_not() -> None:
    for offer in OFFERS:
        if offer.status in {OfferStatus.EXPIRED, OfferStatus.ARCHIVED}:
            assert offer.end_days is not None
            assert offer.end_days < 0
        if offer.status is OfferStatus.PUBLISHED and offer.end_days is not None:
            assert offer.end_days >= 0


def test_steps_are_available_for_every_offer_type() -> None:
    for offer_type in OfferType:
        steps = steps_for(offer_type)
        assert len(steps) == 3
        assert all(set(step) == {"title", "detail"} for step in steps)


def test_sample_data_names_no_real_destination() -> None:
    assert SAMPLE_ORIGIN == "https://example.com"
    assert SAMPLE_NOTE == "SAMPLE DATA — not a real offer"


# --- upserts against a real database ----------------------------------------------------------


def run[T](coroutine: Awaitable[T]) -> T:
    async def wrapped() -> T:
        return await coroutine

    return asyncio.run(wrapped())


def _migrate_to_head(url: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env={**os.environ, "DATABASE_URL_DIRECT": url},
        check=True,
        capture_output=True,
    )


@pytest.fixture
def maker() -> Iterator[async_sessionmaker[AsyncSession]]:
    """Session maker on an empty, migrated catalogue (the per-worker ``*_test`` database)."""
    assert TEST_DATABASE_URL is not None
    target = make_url(TEST_DATABASE_URL)
    assert (target.database or "").endswith("_test"), (
        "refusing to wipe a non-test database"
    )
    assert target.host in LOCAL_HOSTS, "refusing to wipe a non-local database"
    _migrate_to_head(TEST_DATABASE_URL)
    engine = build_engine(TEST_DATABASE_URL)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def clear() -> None:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "TRUNCATE affiliate_links, click_events, offers, merchants, categories"
                    " RESTART IDENTITY CASCADE"
                )
            )

    run(clear())
    yield session_maker
    run(clear())
    run(engine.dispose())


async def _count(session_maker: async_sessionmaker[AsyncSession], model: Any) -> int:
    async with session_maker() as session:
        return int(await session.scalar(select(func.count()).select_from(model)) or 0)


def _counts(session_maker: async_sessionmaker[AsyncSession]) -> dict[str, int]:
    async def gather() -> dict[str, int]:
        return {
            "categories": await _count(session_maker, Category),
            "merchants": await _count(session_maker, Merchant),
            "offers": await _count(session_maker, Offer),
            "affiliate_links": await _count(session_maker, AffiliateLink),
        }

    return run(gather())


def _seed(session_maker: async_sessionmaker[AsyncSession], today: date = TODAY) -> int:
    return seed_catalogue.main(environment="test", maker=session_maker, today=today)


EXPECTED_COUNTS = {"categories": 6, "merchants": 8, "offers": 24, "affiliate_links": 24}


@needs_database
@pytest.mark.parametrize("environment", ["local", "test"])
def test_seeds_an_empty_database_in_local_and_test(
    maker: async_sessionmaker[AsyncSession],
    environment: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = seed_catalogue.main(environment=environment, maker=maker, today=TODAY)

    assert exit_code == 0
    assert _counts(maker) == EXPECTED_COUNTS
    assert "6 categories, 8 merchants, 24 offers and 24 affiliate links" in (
        capsys.readouterr().out
    )


@needs_database
def test_refusal_writes_nothing(maker: async_sessionmaker[AsyncSession]) -> None:
    exit_code = seed_catalogue.main(environment="production", maker=maker, today=TODAY)

    assert exit_code == 1
    assert all(count == 0 for count in _counts(maker).values())


@needs_database
def test_second_run_creates_no_duplicates(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    async def ids() -> set[str]:
        async with maker() as session:
            rows = await session.scalars(select(Offer.id))
            return set(rows)

    assert _seed(maker) == 0
    first_counts, first_ids = _counts(maker), run(ids())

    assert _seed(maker) == 0

    assert _counts(maker) == first_counts == EXPECTED_COUNTS
    assert run(ids()) == first_ids


@needs_database
def test_every_offer_is_sample_data_with_an_example_destination(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    async def load() -> tuple[list[Offer], list[AffiliateLink]]:
        async with maker() as session:
            offers = list(await session.scalars(select(Offer)))
            links = list(await session.scalars(select(AffiliateLink)))
            return offers, links

    _seed(maker)
    offers, links = run(load())

    assert {o.publisher_notes for o in offers} == {SAMPLE_NOTE}
    assert {o.status for o in offers} == set(OfferStatus)
    assert {o.offer_type for o in offers} == set(OfferType)
    assert all(
        link.destination_url.startswith("https://example.com/") for link in links
    )
    assert all(
        o.source_url is None or o.source_url.startswith("https://example.com/")
        for o in offers
    )
    assert len({link.offer_id for link in links}) == 24


@needs_database
def test_dates_are_relative_to_the_day_the_command_runs(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    async def verified() -> dict[str, datetime]:
        async with maker() as session:
            rows = await session.execute(select(Offer.slug, Offer.last_verified_at))
            return {slug: when for slug, when in rows if when is not None}

    _seed(maker, TODAY)
    first = run(verified())
    _seed(maker, TODAY + timedelta(days=3))
    later = run(verified())

    assert first["glow-boosting-face-cream-sample"] == datetime(
        2026, 10, 27, tzinfo=UTC
    )
    assert later["glow-boosting-face-cream-sample"] == datetime(
        2026, 10, 30, tzinfo=UTC
    )
    assert len(later) == 24


@needs_database
def test_changed_rows_are_updated_by_slug(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    offer_slug = "coffee-discovery-pack"

    async def tamper_and_load() -> tuple[str, str]:
        async with maker() as session, session.begin():
            await session.execute(
                update(Offer).where(Offer.slug == offer_slug).values(title="Edited")
            )
            await session.execute(
                update(Merchant).where(Merchant.slug == "good-beans").values(name="X")
            )
            await session.execute(
                update(Category).where(Category.slug == "pets").values(enabled=False)
            )
            await session.execute(
                update(AffiliateLink).values(destination_url="https://other.invalid/x")
            )
        return await _offer_id(maker, offer_slug), await _merchant_id(maker)

    _seed(maker)
    offer_id, merchant_id = run(tamper_and_load())

    assert _seed(maker) == 0

    async def load() -> tuple[Offer, Merchant, Category, list[str]]:
        async with maker() as session:
            offer = await session.scalar(select(Offer).where(Offer.slug == offer_slug))
            merchant = await session.scalar(
                select(Merchant).where(Merchant.slug == "good-beans")
            )
            category = await session.scalar(
                select(Category).where(Category.slug == "pets")
            )
            urls = list(await session.scalars(select(AffiliateLink.destination_url)))
            assert offer and merchant and category
            return offer, merchant, category, urls

    offer, merchant, category, urls = run(load())
    assert offer.title == "Coffee discovery pack"
    assert offer.id == offer_id
    assert merchant.name == "Good Beans (Sample)"
    assert merchant.id == merchant_id
    assert category.enabled is True
    assert all(url.startswith("https://example.com/go/") for url in urls)
    assert _counts(maker) == EXPECTED_COUNTS


async def _offer_id(session_maker: async_sessionmaker[AsyncSession], slug: str) -> str:
    async with session_maker() as session:
        return str(await session.scalar(select(Offer.id).where(Offer.slug == slug)))


async def _merchant_id(session_maker: async_sessionmaker[AsyncSession]) -> str:
    async with session_maker() as session:
        return str(
            await session.scalar(
                select(Merchant.id).where(Merchant.slug == "good-beans")
            )
        )


@needs_database
def test_rows_that_are_not_sample_data_are_left_alone(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    async def add_real_merchant() -> None:
        async with maker() as session, session.begin():
            session.add(Merchant(slug="not-a-sample", name="Kept"))

    async def names() -> set[str]:
        async with maker() as session:
            return set(await session.scalars(select(Merchant.name)))

    run(add_real_merchant())

    _seed(maker)

    assert "Kept" in run(names())
    assert _counts(maker)["merchants"] == 9
