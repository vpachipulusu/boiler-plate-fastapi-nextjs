"""The email providers. Brevo is exercised against a mocked HTTP transport only (ADR-012)."""

import json
import logging
from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.core.email_provider import (
    BrevoEmailProvider,
    ContactDetails,
    DisabledEmailProvider,
    EmailMessage,
    EmailProviderError,
    FakeEmailProvider,
    build_email_provider,
)

MESSAGE = EmailMessage(
    to="sam@example.com",
    subject="Confirm",
    text="plain",
    html="<p>html</p>",
    headers={"List-Unsubscribe": "<https://freejoy.test/u>"},
)
CONTACT = ContactDetails("sam@example.com", ("beauty", "pets"), "WEEKLY")


class Recorder:
    """A mock transport that records requests and answers from a queue of responses."""

    def __init__(self, *responses: httpx.Response | Exception) -> None:
        self.requests: list[httpx.Request] = []
        self._responses = list(responses)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        answer = self._responses.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    def provider(self) -> BrevoEmailProvider:
        return BrevoEmailProvider(
            "test-key", "hello@freejoy.test", "Freejoy", 7, httpx.MockTransport(self)
        )

    def body(self, index: int = 0) -> dict[str, object]:
        return json.loads(self.requests[index].content)


async def test_disabled_provider_sends_nothing_and_logs_without_the_address(
    caplog: pytest.LogCaptureFixture,
) -> None:
    provider = DisabledEmailProvider()

    with caplog.at_level(logging.INFO, logger="yourapp.email"):
        await provider.send(MESSAGE)
        assert await provider.upsert_contact(CONTACT) is None
        await provider.delete_contact("1", "sam@example.com")

    assert "message dropped" in caplog.text
    assert "sam@example.com" not in caplog.text


async def test_fake_provider_records_every_call() -> None:
    provider = FakeEmailProvider()

    await provider.send(MESSAGE)
    first = await provider.upsert_contact(CONTACT)
    await provider.delete_contact("fake-1", "sam@example.com")

    assert provider.sent == [MESSAGE]
    assert provider.upserts == [CONTACT]
    assert first == "fake-1"
    assert provider.deleted == [("fake-1", "sam@example.com")]


async def test_fake_provider_fails_every_call_when_told_to() -> None:
    provider = FakeEmailProvider()
    provider.error = EmailProviderError("send", 500)

    for call in (
        provider.send(MESSAGE),
        provider.upsert_contact(CONTACT),
        provider.delete_contact("1", "a@example.com"),
    ):
        with pytest.raises(EmailProviderError):
            await call

    assert provider.sent == []


async def test_fake_provider_appends_messages_to_the_outbox_file(
    tmp_path: Path,
) -> None:
    outbox = tmp_path / "outbox.jsonl"
    provider = FakeEmailProvider(outbox)

    await provider.send(MESSAGE)
    await provider.send(MESSAGE)

    lines = [json.loads(line) for line in outbox.read_text().splitlines()]
    assert [line["to"] for line in lines] == ["sam@example.com"] * 2
    assert lines[0]["headers"]["List-Unsubscribe"] == "<https://freejoy.test/u>"


async def test_brevo_send_posts_the_message_with_its_headers() -> None:
    recorder = Recorder(httpx.Response(201, json={"messageId": "x"}))

    await recorder.provider().send(MESSAGE)

    request = recorder.requests[0]
    assert (request.method, request.url.path) == ("POST", "/v3/smtp/email")
    assert request.headers["api-key"] == "test-key"
    assert recorder.body() == {
        "sender": {"email": "hello@freejoy.test", "name": "Freejoy"},
        "to": [{"email": "sam@example.com"}],
        "subject": "Confirm",
        "htmlContent": "<p>html</p>",
        "textContent": "plain",
        "headers": {"List-Unsubscribe": "<https://freejoy.test/u>"},
    }


async def test_brevo_send_without_headers_omits_the_field() -> None:
    recorder = Recorder(httpx.Response(201, json={}))

    await recorder.provider().send(EmailMessage("a@example.com", "s", "t", "h"))

    assert "headers" not in recorder.body()


async def test_brevo_upsert_adds_to_the_list_and_returns_the_new_id() -> None:
    recorder = Recorder(httpx.Response(201, json={"id": 42}))

    contact_id = await recorder.provider().upsert_contact(CONTACT)

    assert contact_id == "42"
    assert recorder.requests[0].url.path == "/v3/contacts"
    assert recorder.body() == {
        "email": "sam@example.com",
        "listIds": [7],
        "updateEnabled": True,
        "attributes": {"FREQUENCY": "WEEKLY", "CATEGORIES": "beauty,pets"},
    }


async def test_brevo_upsert_of_an_existing_contact_reads_its_id() -> None:
    recorder = Recorder(httpx.Response(204), httpx.Response(200, json={"id": 9}))

    contact_id = await recorder.provider().upsert_contact(CONTACT)

    assert contact_id == "9"
    lookup = recorder.requests[1]
    assert (lookup.method, lookup.url.raw_path) == (
        "GET",
        b"/v3/contacts/sam%40example.com",
    )


@pytest.mark.parametrize("body", [b"", b"not json", b'["list"]', b'{"id": ""}'])
async def test_brevo_upsert_tolerates_an_unreadable_id(body: bytes) -> None:
    recorder = Recorder(httpx.Response(201, content=body))

    assert await recorder.provider().upsert_contact(CONTACT) is None
    assert len(recorder.requests) == 1


async def test_brevo_delete_erases_the_contact_by_id() -> None:
    recorder = Recorder(httpx.Response(204))

    await recorder.provider().delete_contact("42", "sam@example.com")

    request = recorder.requests[0]
    assert (request.method, request.url.path) == ("DELETE", "/v3/contacts/42")
    assert request.url.params["identifierType"] == "contact_id"


async def test_brevo_delete_falls_back_to_the_address_and_accepts_404() -> None:
    recorder = Recorder(httpx.Response(404))

    await recorder.provider().delete_contact(None, "sam@example.com")

    request = recorder.requests[0]
    assert request.url.raw_path.startswith(b"/v3/contacts/sam%40example.com")
    assert request.url.params["identifierType"] == "email_id"


async def test_brevo_delete_without_any_identifier_does_nothing() -> None:
    recorder = Recorder()

    await recorder.provider().delete_contact(None, None)

    assert recorder.requests == []


async def test_brevo_errors_carry_the_status_but_never_the_body_or_address() -> None:
    recorder = Recorder(httpx.Response(400, json={"message": "bad sam@example.com"}))

    with pytest.raises(EmailProviderError) as caught:
        await recorder.provider().send(MESSAGE)

    assert caught.value.status == 400
    assert caught.value.operation == "send"
    assert "sam@example.com" not in str(caught.value)


async def test_brevo_network_failures_become_provider_errors() -> None:
    recorder = Recorder(httpx.ConnectError("boom sam@example.com"))

    with pytest.raises(EmailProviderError) as caught:
        await recorder.provider().send(MESSAGE)

    assert caught.value.status is None
    assert "sam@example.com" not in str(caught.value)


def settings_with(monkeypatch: pytest.MonkeyPatch, **env: str) -> Settings:
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return Settings(_env_file=None)  # type: ignore[call-arg]


def test_factory_returns_the_disabled_provider_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EMAIL_PROVIDER", raising=False)

    provider = build_email_provider(settings_with(monkeypatch))

    assert isinstance(provider, DisabledEmailProvider)


def test_factory_builds_the_fake_with_an_optional_outbox(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    provider = build_email_provider(
        settings_with(
            monkeypatch,
            EMAIL_PROVIDER="fake",
            EMAIL_FAKE_OUTBOX=str(tmp_path / "o.jsonl"),
        )
    )

    assert isinstance(provider, FakeEmailProvider)
    assert provider._outbox == tmp_path / "o.jsonl"


def test_factory_builds_brevo_from_the_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = build_email_provider(
        settings_with(
            monkeypatch,
            EMAIL_PROVIDER="brevo",
            EMAIL_PROVIDER_API_KEY="k",
            EMAIL_FROM="hello@freejoy.test",
            EMAIL_PROVIDER_LIST_ID="12",
        )
    )

    assert isinstance(provider, BrevoEmailProvider)
    assert provider._list_id == 12
