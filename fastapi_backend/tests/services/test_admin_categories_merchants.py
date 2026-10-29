"""Category and merchant services with in-memory fakes."""

import pytest

from app.core.permissions import AdminContext
from app.services.admin_catalogue_errors import (
    CatalogueNotFound,
    InvalidInput,
    SlugTaken,
)
from app.services.admin_categories import AdminCategoryService
from app.services.admin_merchants import AdminMerchantService
from tests.fakes_admin_catalogue import (
    FakeAuditor,
    FakeCategoryStore,
    FakeMerchantStore,
    FakeSession,
    category,
    merchant,
)

ACTOR = AdminContext("admin1", "admin", frozenset({"categories.write"}))
NEW_CATEGORY = {
    "name": "Beauty & care",
    "short_name": "Beauty",
    "description": "d",
    "intro": "i",
    "tint": "rose",
    "sort_order": 1,
    "enabled": True,
}


def categories(*items):
    store, auditor, session = FakeCategoryStore(*items), FakeAuditor(), FakeSession()
    return AdminCategoryService(store, session, auditor), store, auditor, session


def merchants(*items):
    store, auditor, session = FakeMerchantStore(*items), FakeAuditor(), FakeSession()
    return AdminMerchantService(store, session, auditor), store, auditor, session


async def test_category_create_derives_slug_and_audits_in_one_commit():
    service, _, auditor, session = categories()

    created = await service.create_category(ACTOR, {**NEW_CATEGORY, "slug": None})

    assert created.slug == "beauty-care"
    assert auditor.rows[0]["action"] == "admin.categories.create"
    assert auditor.rows[0]["resource_id"] == created.id and session.commits == 1


async def test_category_slug_conflict_and_invalid_slug_write_nothing():
    service, store, auditor, session = categories(category("beauty-care"))

    with pytest.raises(SlugTaken):
        await service.create_category(ACTOR, NEW_CATEGORY)
    with pytest.raises(InvalidInput) as raised:
        await service.create_category(ACTOR, {**NEW_CATEGORY, "slug": "No Good"})

    assert raised.value.code == "invalid_slug"
    assert len(store.items) == 1 and auditor.rows == [] and session.commits == 0


async def test_category_update_audits_changed_values_for_safe_fields_only():
    service, _, auditor, _ = categories(category("cat1"))

    updated = await service.update_category(
        ACTOR, "cat1", {"name": "Renamed", "intro": "long editorial text"}
    )

    assert updated.name == "Renamed"
    (row,) = auditor.rows
    assert row["before"] == {"name": "Cat1"} and row["after"] == {"name": "Renamed"}
    assert row["details"] == {"fields": ["intro", "name"]}
    assert "long editorial text" not in repr(row)


@pytest.mark.parametrize("changes", [{}, {"slug": "x"}, {"enabled": False}])
async def test_category_update_refuses_empty_or_forbidden_fields(changes):
    service, *_ = categories(category("cat1"))

    with pytest.raises(ValueError, match="Invalid category fields"):
        await service.update_category(ACTOR, "cat1", changes)


async def test_category_toggle_audits_a_change_and_skips_a_no_op():
    service, _, auditor, session = categories(category("cat1"))

    await service.set_enabled(ACTOR, "cat1", True)
    assert auditor.rows == [] and session.commits == 0 and session.rollbacks == 1

    disabled = await service.set_enabled(ACTOR, "cat1", False)
    assert disabled.enabled is False
    assert auditor.rows[0]["action"] == "admin.categories.disable"
    assert auditor.rows[0]["before"] == {"enabled": True}
    assert session.commits == 1

    await service.set_enabled(ACTOR, "cat1", True)
    assert auditor.rows[1]["action"] == "admin.categories.enable"


async def test_category_missing_ids_are_not_found():
    service, *_ = categories()

    with pytest.raises(CatalogueNotFound):
        await service.get_category("ghost")
    with pytest.raises(CatalogueNotFound):
        await service.update_category(ACTOR, "ghost", {"name": "x"})
    with pytest.raises(CatalogueNotFound):
        await service.set_enabled(ACTOR, "ghost", True)


async def test_category_list_clamps_paging():
    service, *_ = categories(category("a"), category("b", enabled=False))

    page = await service.list_categories(None, True, 0, -3)

    assert [item.id for item in page.categories] == ["a"]


async def test_merchant_create_validates_urls_and_derives_slug():
    service, store, auditor, _ = merchants()

    created = await service.create_merchant(
        ACTOR,
        {"name": "Acme Ltd", "website": "https://ACME.example.com", "logo_url": None},
    )
    with pytest.raises(InvalidInput):
        await service.create_merchant(
            ACTOR, {"name": "Evil", "website": "http://evil.example.com"}
        )

    assert created.slug == "acme-ltd" and created.website == "https://acme.example.com"
    assert len(store.items) == 1 and len(auditor.rows) == 1


async def test_merchant_slug_conflict_is_reported():
    service, *_ = merchants(merchant("acme-ltd"))

    with pytest.raises(SlugTaken):
        await service.create_merchant(ACTOR, {"name": "Acme Ltd"})


async def test_merchant_update_validates_urls_and_clears_with_null():
    service, _, auditor, _ = merchants(merchant("m1"))

    updated = await service.update_merchant(
        ACTOR, "m1", {"website": "https://m1.example.com", "name": "M One"}
    )
    cleared = await service.update_merchant(ACTOR, "m1", {"website": None})

    assert updated.name == "M One" and cleared.website is None
    assert auditor.rows[0]["details"] == {"fields": ["name", "website"]}
    with pytest.raises(InvalidInput):
        await service.update_merchant(ACTOR, "m1", {"logo_url": "javascript:alert(1)"})
    with pytest.raises(ValueError, match="Invalid merchant fields"):
        await service.update_merchant(ACTOR, "m1", {"active": False})


async def test_merchant_toggle_and_missing_ids():
    service, _, auditor, session = merchants(merchant("m1"))

    await service.set_active(ACTOR, "m1", True)
    off = await service.set_active(ACTOR, "m1", False)

    assert off.active is False and session.rollbacks == 1
    assert [row["action"] for row in auditor.rows] == ["admin.merchants.deactivate"]
    with pytest.raises(CatalogueNotFound):
        await service.set_active(ACTOR, "ghost", False)
    with pytest.raises(CatalogueNotFound):
        await service.get_merchant("ghost")
    with pytest.raises(CatalogueNotFound):
        await service.update_merchant(ACTOR, "ghost", {"name": "x"})


async def test_merchant_list_clamps_paging():
    service, *_ = merchants(merchant("a"), merchant("b", active=False))

    page = await service.list_merchants(None, None, 10_000, -1)

    assert page.total_count == 2
