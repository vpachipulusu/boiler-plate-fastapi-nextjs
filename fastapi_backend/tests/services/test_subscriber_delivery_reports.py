"""Delivery failures reach Sentry as a class and an operation/status, never as the original message."""

from collections.abc import Iterator
from typing import Any

import pytest
import sentry_sdk

from app.core.config import Settings
from app.core.email_provider import EmailProviderError
from app.core.sentry import init_sentry
from tests.core.test_sentry import DSN, RecordingTransport
from tests.fakes_subscribers import Harness, link_tokens, make_request

EMAIL = "sam@example.com"


@pytest.fixture
def transport() -> Iterator[RecordingTransport]:
    recording = RecordingTransport()
    init_sentry(
        Settings(  # type: ignore[call-arg]
            DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
            ENVIRONMENT="test",
            SENTRY_DSN=DSN,
        ),
        transport=recording,
    )
    yield recording
    sentry_sdk.get_global_scope().client = None  # type: ignore[assignment]
    sentry_sdk.init()


def exception_values(transport: RecordingTransport) -> list[dict[str, Any]]:
    return [
        value
        for event in transport.events
        for value in event.get("exception", {}).get("values", [])
    ]


async def test_a_provider_failure_is_reported_with_operation_and_status_only(
    transport: RecordingTransport,
) -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 503)

    await harness.subscribe(make_request(EMAIL))

    (value,) = exception_values(transport)
    assert value["type"] == "ConfirmationDeliveryFailed"
    assert value["value"] == "send 503"


async def test_an_unexpected_error_is_reported_by_class_name_only(
    transport: RecordingTransport,
) -> None:
    harness = Harness()

    async def explode(message: object) -> None:
        raise RuntimeError(f"boom for {EMAIL}")

    harness.provider.send = explode  # type: ignore[method-assign]

    pending = await harness.service.subscribe(make_request(EMAIL))
    assert pending is not None
    await harness.delivery.deliver(pending)

    values = exception_values(transport)
    assert [value["type"] for value in values] == ["ConfirmationDeliveryFailed"]
    token = link_tokens(pending.message.text)["confirm"]
    everything = repr(transport.events)
    assert "RuntimeError" in values[0]["value"]
    assert EMAIL not in everything and "boom" not in everything
    assert token not in everything


async def test_a_failed_withdrawal_is_reported_by_class_name_only(
    transport: RecordingTransport,
) -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 500)

    async def broken(subscriber_id: str, token_hash: str) -> None:
        raise ConnectionError(f"database down for {EMAIL}")

    harness.store.clear_confirmation = broken  # type: ignore[method-assign]

    await harness.subscribe(make_request(EMAIL))

    values = exception_values(transport)
    assert [value["value"] for value in values] == [
        "send 500",
        "withdraw ConnectionError",
    ]
    assert EMAIL not in repr(transport.events)
