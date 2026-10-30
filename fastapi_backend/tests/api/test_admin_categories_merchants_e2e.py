"""End to end: admin categories, merchants and the closed permission registry on real Postgres."""

import asyncio
import json

import pytest

import tests.catalogue_e2e_support as support
from tests.catalogue_e2e_support import (
    CATEGORY_BODY,
    EDITOR,
    as_user,
    audit_rows,
    rows,
    seed_admin,
)

pytestmark = support.requires_database
database_url, engine, client = support.database_url, support.engine, support.client

CATEGORIES = "/v1/admin/categories"
MERCHANTS = "/v1/admin/merchants"


class NoAccounts:
    """Stands in for FirebaseIdentityProvider; the grant routes never call it."""


@pytest.fixture
async def editor(engine):
    await seed_admin(engine, "editor", EDITOR)
    return as_user("editor")


async def test_category_lifecycle_is_persisted_and_audited(client, engine, editor):
    created = await client.post(CATEGORIES, json=CATEGORY_BODY, headers=editor)
    category_id = created.json()["data"]["id"]
    updated = await client.patch(
        f"{CATEGORIES}/{category_id}",
        json={"name": "Home", "sort_order": 4},
        headers=editor,
    )
    disabled = await client.post(f"{CATEGORIES}/{category_id}/disable", headers=editor)
    again = await client.post(f"{CATEGORIES}/{category_id}/disable", headers=editor)
    enabled = await client.post(f"{CATEGORIES}/{category_id}/enable", headers=editor)

    assert (
        created.status_code == 201 and created.json()["data"]["slug"] == "home-cleaning"
    )
    assert updated.json()["data"]["name"] == "Home"
    assert disabled.json()["data"]["enabled"] is False and again.status_code == 200
    assert enabled.json()["data"]["enabled"] is True
    assert [r[1] for r in await audit_rows(engine)] == [
        "admin.categories.create",
        "admin.categories.update",
        "admin.categories.disable",
        "admin.categories.enable",
    ]
    assert all(
        r[2] == "categories" and r[3] == category_id for r in await audit_rows(engine)
    )


async def test_category_duplicate_slug_is_409_and_a_race_leaves_one_row(
    client, engine, editor
):
    first = await client.post(CATEGORIES, json=CATEGORY_BODY, headers=editor)
    clash = await client.post(CATEGORIES, json=CATEGORY_BODY, headers=editor)
    race_body = {**CATEGORY_BODY, "name": "Racing"}
    race = await asyncio.gather(
        client.post(CATEGORIES, json=race_body, headers=editor),
        client.post(CATEGORIES, json=race_body, headers=editor),
    )

    assert first.status_code == 201
    assert (clash.status_code, clash.json()["code"]) == (409, "slug_taken")
    assert sorted(r.status_code for r in race) == [201, 409]
    assert (
        len(await rows(engine, "SELECT 1 FROM categories WHERE slug = 'racing'")) == 1
    )
    assert len(await audit_rows(engine, "admin.categories.create")) == 2


async def test_category_validation_and_not_found(client, engine, editor):
    bad_slug = await client.post(
        CATEGORIES, json={**CATEGORY_BODY, "slug": "Not A Slug"}, headers=editor
    )
    bad_tint = await client.post(
        CATEGORIES, json={**CATEGORY_BODY, "tint": "NOT OK"}, headers=editor
    )
    missing = await client.get(f"{CATEGORIES}/ghost", headers=editor)
    patch_missing = await client.patch(
        f"{CATEGORIES}/ghost", json={"name": "x"}, headers=editor
    )
    toggle_missing = await client.post(f"{CATEGORIES}/ghost/enable", headers=editor)

    assert (bad_slug.status_code, bad_slug.json()["code"]) == (422, "invalid_slug")
    assert bad_tint.status_code == 422
    assert [r.status_code for r in (missing, patch_missing, toggle_missing)] == [
        404
    ] * 3
    assert await audit_rows(engine) == []


async def test_category_list_filters_search_and_empty_state(client, engine, editor):
    empty = await client.get(CATEGORIES, headers=editor)
    first = await client.post(CATEGORIES, json=CATEGORY_BODY, headers=editor)
    await client.post(
        CATEGORIES,
        json={**CATEGORY_BODY, "name": "Beauty", "sort_order": 1},
        headers=editor,
    )
    await client.post(
        f"{CATEGORIES}/{first.json()['data']['id']}/disable", headers=editor
    )

    enabled = await client.get(f"{CATEGORIES}?enabled=true", headers=editor)
    disabled = await client.get(f"{CATEGORIES}?enabled=false", headers=editor)
    found = await client.get(f"{CATEGORIES}?search=beau", headers=editor)
    wildcard = await client.get(f"{CATEGORIES}?search=_", headers=editor)
    paged = await client.get(f"{CATEGORIES}?limit=1&offset=1", headers=editor)

    assert empty.json()["data"] == {
        "categories": [],
        "total_count": 0,
        "limit": 50,
        "offset": 0,
    }
    assert [c["name"] for c in enabled.json()["data"]["categories"]] == ["Beauty"]
    assert [c["name"] for c in disabled.json()["data"]["categories"]] == [
        "Home & cleaning"
    ]
    assert found.json()["data"]["total_count"] == 1
    assert wildcard.json()["data"]["total_count"] == 0
    assert (
        paged.json()["data"]["total_count"] == 2
        and len(paged.json()["data"]["categories"]) == 1
    )


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("POST", CATEGORIES, CATEGORY_BODY),
        ("PATCH", f"{CATEGORIES}/x", {"name": "x"}),
        ("POST", f"{CATEGORIES}/x/enable", None),
        ("POST", f"{CATEGORIES}/x/disable", None),
        ("POST", MERCHANTS, {"name": "Acme"}),
        ("PATCH", f"{MERCHANTS}/x", {"name": "x"}),
        ("POST", f"{MERCHANTS}/x/activate", None),
        ("POST", f"{MERCHANTS}/x/deactivate", None),
    ],
)
async def test_offer_writers_cannot_change_categories_or_merchants(
    client, engine, method, path, body
):
    await seed_admin(
        engine, "writer", ["offers.read", "offers.write", "offers.publish"]
    )

    result = await client.request(method, path, json=body, headers=as_user("writer"))

    assert result.status_code == 403
    assert await audit_rows(engine) == []
    assert await rows(engine, "SELECT 1 FROM categories") == []


async def test_merchant_lifecycle_urls_and_audit(client, engine, editor):
    created = await client.post(
        MERCHANTS,
        json={"name": "Acme Ltd", "website": "https://Acme.example.com/"},
        headers=editor,
    )
    merchant_id = created.json()["data"]["id"]
    unsafe_site = await client.post(
        MERCHANTS,
        json={"name": "Evil", "website": "http://evil.example.com"},
        headers=editor,
    )
    unsafe_logo = await client.patch(
        f"{MERCHANTS}/{merchant_id}",
        json={"logo_url": "javascript:alert(1)"},
        headers=editor,
    )
    updated = await client.patch(
        f"{MERCHANTS}/{merchant_id}",
        json={"logo_url": "https://cdn.example.com/acme.png"},
        headers=editor,
    )
    off = await client.post(f"{MERCHANTS}/{merchant_id}/deactivate", headers=editor)
    on = await client.post(f"{MERCHANTS}/{merchant_id}/activate", headers=editor)
    duplicate = await client.post(MERCHANTS, json={"name": "ACME  ltd"}, headers=editor)

    assert created.json()["data"]["website"] == "https://acme.example.com/"
    assert unsafe_site.json()["code"] == "invalid_url"
    assert unsafe_logo.json()["code"] == "invalid_url"
    assert updated.json()["data"]["logo_url"] == "https://cdn.example.com/acme.png"
    assert (off.json()["data"]["active"], on.json()["data"]["active"]) == (False, True)
    assert (duplicate.status_code, duplicate.json()["code"]) == (409, "slug_taken")
    assert [r[1] for r in await audit_rows(engine)] == [
        "admin.merchants.create",
        "admin.merchants.update",
        "admin.merchants.deactivate",
        "admin.merchants.activate",
    ]
    stored = await rows(engine, "SELECT logo_url FROM merchants")
    assert stored == [("https://cdn.example.com/acme.png",)]


async def test_merchant_list_and_not_found(client, engine, editor):
    empty = await client.get(MERCHANTS, headers=editor)
    await client.post(MERCHANTS, json={"name": "Acme"}, headers=editor)
    await client.post(MERCHANTS, json={"name": "Zed", "active": False}, headers=editor)

    active = await client.get(f"{MERCHANTS}?active=true", headers=editor)
    search = await client.get(f"{MERCHANTS}?search=ze", headers=editor)
    missing = await client.get(f"{MERCHANTS}/ghost", headers=editor)

    assert empty.json()["data"]["merchants"] == []
    assert [m["name"] for m in active.json()["data"]["merchants"]] == ["Acme"]
    assert search.json()["data"]["total_count"] == 1
    assert (missing.status_code, missing.json()["code"]) == (404, "not_found")


async def test_audit_rows_carry_no_secrets_or_user_emails(client, engine, editor):
    await client.post(CATEGORIES, json=CATEGORY_BODY, headers=editor)
    await client.post(
        MERCHANTS,
        json={"name": "Acme", "website": "https://a.example.com"},
        headers=editor,
    )

    dump = json.dumps([list(r) for r in await audit_rows(engine)], default=str)

    assert "editor@example.com" not in dump
    assert "X-Internal-Key" not in dump and support.KEY not in dump
    # The merchant website is deliberately audited: it decides where `direct` links may point.
    assert "https://a.example.com" in dump


async def test_a_merchant_website_change_is_audited_with_the_old_and_new_value(
    client, engine, editor
):
    created = await client.post(
        MERCHANTS,
        json={"name": "Acme", "website": "https://a.example.com"},
        headers=editor,
    )
    merchant_id = created.json()["data"]["id"]

    await client.patch(
        f"{MERCHANTS}/{merchant_id}",
        json={"website": "https://b.example.com"},
        headers=editor,
    )

    updates = [
        row
        for row in await audit_rows(engine, "admin.merchants.update")
        if row[3] == merchant_id
    ]
    (row,) = updates
    dump = json.dumps(list(row), default=str)
    assert "https://a.example.com" in dump and "https://b.example.com" in dump


async def test_registry_is_closed_nobody_grants_a_catalogue_permission_they_lack(
    client, engine, monkeypatch
):
    monkeypatch.setattr("app.api.v1.admin_users.FirebaseIdentityProvider", NoAccounts)
    manager = await seed_admin(
        engine, "mgr", ["admins.create", "users.read", "offers.read"]
    )
    target = await seed_admin(engine, "bob")
    headers = as_user("mgr")

    own = await client.put(
        f"/v1/admin/users/{manager}/admin",
        json={"role": "admin", "permissions": ["offers.publish"]},
        headers=headers,
    )
    other = await client.put(
        f"/v1/admin/users/{target}/admin",
        json={"role": "admin", "permissions": ["offers.publish"]},
        headers=headers,
    )
    allowed = await client.put(
        f"/v1/admin/users/{target}/admin",
        json={"role": "admin", "permissions": ["offers.read"]},
        headers=headers,
    )
    invented = await client.put(
        f"/v1/admin/users/{target}/admin",
        json={"role": "admin", "permissions": ["offers.superpower"]},
        headers=headers,
    )
    wildcard = await client.put(
        f"/v1/admin/users/{manager}/admin",
        json={"role": "admin", "permissions": ["*"]},
        headers=headers,
    )

    assert (own.status_code, other.status_code) == (403, 403)
    assert allowed.status_code == 200
    assert invented.status_code == 422
    assert wildcard.status_code == 422
    stored = await rows(
        engine, "SELECT permissions FROM admin_users WHERE user_id = :i", i=manager
    )
    assert stored[0][0] == ["admins.create", "users.read", "offers.read"]
