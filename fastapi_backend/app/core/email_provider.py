"""Email provider seam for alerts (ADR-012): a ``Protocol`` and its implementations.

* ``DisabledEmailProvider``: used when ``EMAIL_PROVIDER`` is unset (every local and test run). Nothing is
  sent; it only logs that a message was dropped, never an address.
* ``FakeEmailProvider``: records every call. Tests use it directly; ``EMAIL_PROVIDER=fake`` (refused outside
  local and test) also appends each message to ``EMAIL_FAKE_OUTBOX`` so a browser test can read the link.
* ``BrevoEmailProvider``: Brevo's REST API over ``httpx`` (no SDK).

Errors never carry a response body or an address: a body can echo the address back, and these errors reach
logs. Only the operation and the HTTP status are kept.
"""

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import quote

import httpx

from app.core.config import Settings

logger = logging.getLogger("yourapp.email")

BREVO_BASE_URL = "https://api.brevo.com/v3"
REQUEST_TIMEOUT_SECONDS = 8.0
NO_CONTENT = 204


@dataclass(frozen=True)
class EmailMessage:
    """One email. ``headers`` carries ``List-Unsubscribe`` and friends."""

    to: str
    subject: str
    text: str
    html: str
    headers: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ContactDetails:
    """What the provider's list needs to know about a confirmed subscriber."""

    email: str
    categories: tuple[str, ...]
    frequency: str


class EmailProviderError(Exception):
    """A provider call failed. ``status`` is the HTTP status when there was one."""

    def __init__(self, operation: str, status: int | None = None) -> None:
        super().__init__(f"email provider {operation} failed (status={status})")
        self.operation = operation
        self.status = status


class EmailProvider(Protocol):
    async def send(self, message: EmailMessage) -> None: ...

    async def upsert_contact(self, contact: ContactDetails) -> str | None:
        """Add the contact to the alerts list (idempotent); the provider's id for it, if any."""
        ...

    async def delete_contact(self, provider_id: str | None, email: str | None) -> None:
        """Erase the contact at the provider, which also takes it off every list.

        Idempotent: an unknown contact is fine. Names the contact by ``provider_id`` when known, else by
        ``email``.
        """
        ...


class DisabledEmailProvider:
    """No provider configured: nothing is sent and nothing is stored anywhere."""

    async def send(self, message: EmailMessage) -> None:
        logger.info("email provider not configured: message dropped, not sent")

    async def upsert_contact(self, contact: ContactDetails) -> str | None:
        logger.info("email provider not configured: contact not synced")
        return None

    async def delete_contact(self, provider_id: str | None, email: str | None) -> None:
        logger.info("email provider not configured: contact not deleted")


class FakeEmailProvider:
    """Records calls; sends nothing. Set ``error`` to make every call fail."""

    def __init__(self, outbox: Path | None = None) -> None:
        self.sent: list[EmailMessage] = []
        self.upserts: list[ContactDetails] = []
        self.deleted: list[tuple[str | None, str | None]] = []
        self.error: EmailProviderError | None = None
        self._outbox = outbox

    def _check(self) -> None:
        if self.error is not None:
            raise self.error

    async def send(self, message: EmailMessage) -> None:
        self._check()
        self.sent.append(message)
        if self._outbox is not None:
            line = json.dumps(
                {
                    "to": message.to,
                    "subject": message.subject,
                    "text": message.text,
                    "headers": dict(message.headers),
                }
            )
            with self._outbox.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")

    async def upsert_contact(self, contact: ContactDetails) -> str | None:
        self._check()
        self.upserts.append(contact)
        return f"fake-{len(self.upserts)}"

    async def delete_contact(self, provider_id: str | None, email: str | None) -> None:
        self._check()
        self.deleted.append((provider_id, email))


class BrevoEmailProvider:
    """Brevo REST v3. Not yet run against a live account: see ADR-012."""

    def __init__(
        self,
        api_key: str,
        sender_email: str,
        sender_name: str,
        list_id: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._sender = {"email": sender_email, "name": sender_name}
        self._list_id = list_id
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        # A client per call: no pool to go stale on a serverless runtime.
        return httpx.AsyncClient(
            base_url=BREVO_BASE_URL,
            headers={"api-key": self._api_key, "accept": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
            transport=self._transport,
        )

    async def _request(
        self,
        operation: str,
        method: str,
        path: str,
        *,
        json_body: Mapping[str, Any] | None = None,
        params: Mapping[str, str] | None = None,
        tolerate: frozenset[int] = frozenset(),
    ) -> httpx.Response:
        try:
            async with self._client() as client:
                response = await client.request(
                    method, path, json=json_body, params=params
                )
        except httpx.HTTPError as exc:
            raise EmailProviderError(operation) from exc
        if response.status_code >= 400 and response.status_code not in tolerate:
            raise EmailProviderError(operation, response.status_code)
        return response

    async def send(self, message: EmailMessage) -> None:
        body: dict[str, Any] = {
            "sender": self._sender,
            "to": [{"email": message.to}],
            "subject": message.subject,
            "htmlContent": message.html,
            "textContent": message.text,
        }
        if message.headers:
            body["headers"] = dict(message.headers)
        await self._request("send", "POST", "/smtp/email", json_body=body)

    async def upsert_contact(self, contact: ContactDetails) -> str | None:
        body = {
            "email": contact.email,
            "listIds": [self._list_id],
            "updateEnabled": True,
            "attributes": {
                "FREQUENCY": contact.frequency,
                "CATEGORIES": ",".join(contact.categories),
            },
        }
        created = await self._request("upsert", "POST", "/contacts", json_body=body)
        found = _contact_id(created)
        if found is not None or created.status_code != NO_CONTENT:
            return found
        # An existing contact answers 204 with no body; read its id.
        existing = await self._request(
            "lookup", "GET", f"/contacts/{quote(contact.email, safe='')}"
        )
        return _contact_id(existing)

    async def delete_contact(self, provider_id: str | None, email: str | None) -> None:
        if provider_id:
            identifier, kind = provider_id, "contact_id"
        elif email:
            identifier, kind = email, "email_id"
        else:
            return
        await self._request(
            "delete",
            "DELETE",
            f"/contacts/{quote(identifier, safe='')}",
            params={"identifierType": kind},
            tolerate=frozenset({404}),
        )


def _contact_id(response: httpx.Response) -> str | None:
    try:
        value = response.json().get("id")
    except (ValueError, AttributeError):
        return None
    return str(value) if isinstance(value, int | str) and value != "" else None


def build_email_provider(settings: Settings) -> EmailProvider:
    """The provider ``EMAIL_PROVIDER`` names; the disabled one when it is unset.

    Settings validation already guarantees the variables each provider needs.
    """
    if settings.EMAIL_PROVIDER == "brevo":
        key = settings.EMAIL_PROVIDER_API_KEY
        assert key is not None  # validated at startup
        return BrevoEmailProvider(
            key.get_secret_value(),
            settings.EMAIL_FROM,
            settings.EMAIL_FROM_NAME,
            int(settings.EMAIL_PROVIDER_LIST_ID),
        )
    if settings.EMAIL_PROVIDER == "fake":
        outbox = (
            Path(settings.EMAIL_FAKE_OUTBOX) if settings.EMAIL_FAKE_OUTBOX else None
        )
        return FakeEmailProvider(outbox)
    return DisabledEmailProvider()
