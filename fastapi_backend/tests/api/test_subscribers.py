"""/v1/subscribers: contract, uniform answers, validation, rate limits and privacy, over fakes.

The routes, schemas, service, token codec and rate-limit dependencies are real; the store, the email
provider and the limiter are the in-memory fakes.
"""

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_rate_limiter, get_session_provider
from app.api.v1.subscribers import get_subscriber_service
from app.core.config import settings
from app.core.email_provider import EmailProviderError
from app.core.rate_limit import SUBSCRIBE_EMAIL_POLICY, SUBSCRIBE_IP_POLICY
from app.main import create_app
from tests.fakes import (
    FakeRateLimiter,
    FakeSession,
    FakeSessionProvider,
    RaisingRateLimiter,
    as_limiter,
)
from tests.fakes_subscribers import Harness, link_tokens

KEY = "test-only-internal-service-key-not-for-deployment"
EMAIL = "sam@example.com"
VALID: dict[str, Any] = {
    "email": EMAIL,
    "categories": ["beauty", "pets"],
    "frequency": "WEEKLY",
    "consent": True,
    "consent_text": "I agree to receive freebie emails from Freejoy.",
    "consent_source": "alerts_page",
}


def build(
    harness: Harness | None = None,
    limiter: FakeRateLimiter | RaisingRateLimiter | None = None,
) -> tuple[AsyncClient, Harness, FakeRateLimiter | RaisingRateLimiter]:
    harness = harness or Harness()
    limiter = limiter or FakeRateLimiter()
    app = create_app()
    app.dependency_overrides[get_subscriber_service] = lambda: harness.service
    app.dependency_overrides[get_rate_limiter] = lambda: as_limiter(limiter)
    client = AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
        headers={"X-Internal-Key": KEY},
    )
    return client, harness, limiter


async def test_subscribe_answers_202_with_no_store_and_sends_the_email() -> None:
    http, harness, _ = build()

    async with http:
        response = await http.post("/v1/subscribers", json=VALID)

    assert response.status_code == 202
    assert response.json() == {"success": True, "data": {"status": "accepted"}}
    assert response.headers["cache-control"] == "no-store"
    assert [m.to for m in harness.provider.sent] == [EMAIL]


async def test_every_address_state_gets_the_same_status_and_body() -> None:
    http, harness, _ = build()

    async with http:
        first = await http.post("/v1/subscribers", json=VALID)
        throttled = await http.post("/v1/subscribers", json=VALID)
        await http.post(
            "/v1/subscribers/confirm",
            json={"token": link_tokens(harness.provider.sent[0].text)["confirm"]},
        )
        confirmed = await http.post("/v1/subscribers", json=VALID)

    assert len(harness.provider.sent) == 1
    for other in (throttled, confirmed):
        assert (other.status_code, other.json()) == (first.status_code, first.json())
        assert other.headers["cache-control"] == first.headers["cache-control"]


async def test_the_address_is_trimmed_and_lower_cased_before_use() -> None:
    http, harness, _ = build()

    async with http:
        await http.post(
            "/v1/subscribers", json={**VALID, "email": "  Sam@Example.COM "}
        )

    assert [m.to for m in harness.provider.sent] == [EMAIL]
    assert next(iter(harness.store.rows.values())).email == EMAIL


async def test_duplicate_categories_are_stored_once() -> None:
    http, harness, _ = build()

    async with http:
        await http.post(
            "/v1/subscribers", json={**VALID, "categories": ["pets", "pets", "beauty"]}
        )

    assert next(iter(harness.store.rows.values())).categories == ("pets", "beauty")


async def test_subscribe_is_limited_by_client_ip_and_a_hash_of_the_address() -> None:
    http, _, limiter = build()

    async with http:
        await http.post("/v1/subscribers", json=VALID)

    identifiers = [identifier for identifier, _ in limiter.hits]
    assert len(identifiers) == 2
    assert identifiers[0].startswith("subscribe:ip:")
    assert identifiers[1].startswith("subscribe_email:email:")
    assert EMAIL not in " ".join(identifiers)
    assert [policy for _, policy in limiter.hits] == [
        SUBSCRIBE_IP_POLICY,
        SUBSCRIBE_EMAIL_POLICY,
    ]


def test_the_ip_limit_is_looser_than_the_address_limit() -> None:
    assert SUBSCRIBE_IP_POLICY.limit == 20
    assert SUBSCRIBE_EMAIL_POLICY.limit == 5
    assert SUBSCRIBE_IP_POLICY.fail_closed and SUBSCRIBE_EMAIL_POLICY.fail_closed


async def test_the_sixth_request_for_one_address_is_refused_with_429() -> None:
    http, _, _ = build()

    async with http:
        statuses = [
            (await http.post("/v1/subscribers", json=VALID)).status_code
            for _ in range(SUBSCRIBE_EMAIL_POLICY.limit + 1)
        ]

    assert statuses == [202] * SUBSCRIBE_EMAIL_POLICY.limit + [429]


async def test_a_limiter_outage_refuses_signups_instead_of_opening_a_mail_relay() -> (
    None
):
    http, harness, _ = build(limiter=RaisingRateLimiter())

    async with http:
        response = await http.post("/v1/subscribers", json=VALID)

    assert response.status_code == 503
    assert harness.provider.sent == []


async def test_subscribe_needs_the_internal_key() -> None:
    http, harness, _ = build()

    async with http:
        response = await http.post(
            "/v1/subscribers", json=VALID, headers={"X-Internal-Key": "wrong"}
        )

    assert response.status_code == 401
    assert harness.provider.sent == []


@pytest.mark.parametrize(
    "change",
    [
        {"email": "not-an-email"},
        {"email": "a@b.co" + "x" * 260},
        {"categories": []},
        {"categories": ["Bad Slug"]},
        {"categories": ["ok"] * 21 + ["a", "b"]},
        {"frequency": "HOURLY"},
        {"consent": False},
        {"consent_text": ""},
        {"consent_source": "somewhere-else"},
        {"unexpected": 1},
    ],
)
async def test_invalid_bodies_are_422_and_send_nothing(change: dict[str, Any]) -> None:
    http, harness, _ = build()

    async with http:
        response = await http.post("/v1/subscribers", json={**VALID, **change})

    assert response.status_code == 422
    assert response.json() == {"success": False, "error": "Invalid request"}
    assert harness.provider.sent == []


async def test_a_provider_failure_is_a_retryable_503_with_no_detail() -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 500)
    http, _, _ = build(harness)

    async with http:
        response = await http.post("/v1/subscribers", json=VALID)

    assert response.status_code == 503
    assert response.headers["retry-after"] == "5"
    assert response.json() == {
        "success": False,
        "error": "Service temporarily unavailable",
    }


async def test_confirm_returns_confirmed_and_the_response_never_echoes_a_token() -> (
    None
):
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        token = link_tokens(harness.provider.sent[0].text)["confirm"]

        response = await http.post("/v1/subscribers/confirm", json={"token": token})

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"status": "confirmed"}}
    assert token not in response.text


async def test_forged_replayed_and_wrong_purpose_tokens_get_the_same_400() -> None:
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        links = link_tokens(harness.provider.sent[0].text)
        await http.post("/v1/subscribers/confirm", json={"token": links["confirm"]})

        replayed = await http.post(
            "/v1/subscribers/confirm", json={"token": links["confirm"]}
        )
        wrong_purpose = await http.post(
            "/v1/subscribers/confirm", json={"token": links["unsubscribe"]}
        )
        forged = await http.post("/v1/subscribers/confirm", json={"token": "a.b"})

    expected = {"success": False, "error": "Invalid or expired link"}
    for response in (replayed, wrong_purpose, forged):
        assert response.status_code == 400
        assert response.json() == expected


async def test_a_confirm_sync_failure_is_a_retryable_503() -> None:
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        token = link_tokens(harness.provider.sent[0].text)["confirm"]
        harness.provider.error = EmailProviderError("upsert", 500)

        response = await http.post("/v1/subscribers/confirm", json={"token": token})

    assert response.status_code == 503


async def test_unsubscribe_is_idempotent_and_confirm_tokens_are_refused() -> None:
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        links = link_tokens(harness.provider.sent[0].text)
        first = await http.post(
            "/v1/subscribers/unsubscribe", json={"token": links["unsubscribe"]}
        )
        second = await http.post(
            "/v1/subscribers/unsubscribe", json={"token": links["unsubscribe"]}
        )
        wrong = await http.post(
            "/v1/subscribers/unsubscribe", json={"token": links["confirm"]}
        )

    assert (first.status_code, second.status_code, wrong.status_code) == (200, 200, 400)
    assert first.json() == {"success": True, "data": {"status": "unsubscribed"}}


async def test_unsubscribe_provider_failure_is_a_retryable_503() -> None:
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        token = link_tokens(harness.provider.sent[0].text)["unsubscribe"]
        harness.provider.error = EmailProviderError("remove", 500)

        response = await http.post("/v1/subscribers/unsubscribe", json={"token": token})

    assert response.status_code == 503


@pytest.mark.parametrize("path", ["confirm", "unsubscribe"])
async def test_token_routes_are_limited_by_client_ip_only(path: str) -> None:
    http, _, limiter = build()

    async with http:
        await http.post(f"/v1/subscribers/{path}", json={"token": "a.b"})

    assert [identifier.split(":")[:2] for identifier, _ in limiter.hits] == [
        ["subscriber_token", "ip"]
    ]


@pytest.mark.parametrize(
    "body", [{}, {"token": ""}, {"token": "x" * 513}, {"token": "a", "extra": 1}]
)
async def test_token_routes_validate_the_body(body: dict[str, Any]) -> None:
    http, _, _ = build()

    async with http:
        response = await http.post("/v1/subscribers/confirm", json=body)

    assert response.status_code == 422


async def test_without_a_token_secret_the_routes_answer_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "SUBSCRIBER_TOKEN_SECRET", None)
    app = create_app()
    app.dependency_overrides[get_session_provider] = lambda: FakeSessionProvider(
        FakeSession()
    )
    app.dependency_overrides[get_rate_limiter] = lambda: as_limiter(FakeRateLimiter())

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
        headers={"X-Internal-Key": KEY},
    ) as http:
        response = await http.post("/v1/subscribers", json=VALID)

    assert response.status_code == 503


async def test_production_without_a_provider_refuses_signups_but_not_unsubscribes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http, harness, _ = build()
    async with http:
        await http.post("/v1/subscribers", json=VALID)
        token = link_tokens(harness.provider.sent[0].text)["unsubscribe"]
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(settings, "VERCEL_ENV", None)
        monkeypatch.setattr(settings, "EMAIL_PROVIDER", "")

        signup = await http.post("/v1/subscribers", json=VALID)
        unsubscribe = await http.post(
            "/v1/subscribers/unsubscribe", json={"token": token}
        )

    assert signup.status_code == 503
    assert unsubscribe.status_code == 200


async def test_a_non_ascii_address_is_refused_before_anything_is_stored() -> None:
    http, harness, _ = build()

    async with http:
        response = await http.post(
            "/v1/subscribers", json={**VALID, "email": "såm@example.com"}
        )

    assert response.status_code == 422
    assert harness.provider.sent == []


async def test_one_ip_may_sign_up_many_different_addresses_up_to_its_own_limit() -> (
    None
):
    http, _, _ = build()

    async with http:
        statuses = [
            (
                await http.post(
                    "/v1/subscribers", json={**VALID, "email": f"person{n}@example.com"}
                )
            ).status_code
            for n in range(SUBSCRIBE_IP_POLICY.limit + 1)
        ]

    assert statuses == [202] * SUBSCRIBE_IP_POLICY.limit + [429]


async def test_a_vercel_preview_without_a_provider_refuses_signups(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http, harness, _ = build()
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "VERCEL_ENV", "preview")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "")

    async with http:
        response = await http.post("/v1/subscribers", json=VALID)

    assert response.status_code == 503
    assert harness.provider.sent == []
