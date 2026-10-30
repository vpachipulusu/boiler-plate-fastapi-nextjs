"""Alerts sign-up: double opt-in, confirmation, one-click unsubscribe.

Privacy rules the code keeps (see ``docs/developer/backend-subscribers.md``):

* ``subscribe`` is silent about state. A new address, a pending one, a confirmed one and an unsubscribed one
  all return normally, so the response cannot be used to learn who is on the list. A confirmed subscriber is
  never changed by an unauthenticated submission (anyone can type an address).
* A confirmation email is re-sent at most once per ``RESEND_INTERVAL``.
* Only a SHA-256 of the latest confirm token is stored; a newer token replaces it, and confirming clears it,
  so a token works once. Every token failure raises the same ``InvalidToken``.
* Nothing here logs an address or a token.
"""

import hmac
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from app.core.email_provider import (
    ContactDetails,
    EmailProvider,
    EmailProviderError,
)
from app.core.subscriber_tokens import (
    CONFIRM_TOKEN_TTL,
    SubscriberTokens,
    TokenPurpose,
    token_digest,
)
from app.models.platform.email_subscriber import AlertFrequency, SubscriberStatus
from app.repositories.subscribers import SubscriberRecord
from app.services.subscriber_emails import confirmation_message

logger = logging.getLogger("yourapp.subscribers")

RESEND_INTERVAL = timedelta(hours=1)
# Retention (documented in the privacy notice, "for legal review"): see commands/purge_subscribers.py.
PENDING_RETENTION = timedelta(days=30)
UNSUBSCRIBED_RETENTION = timedelta(days=365)


class InvalidToken(Exception):
    """The token is malformed, forged, expired, used or for another purpose: one error for all."""


class ProviderUnavailable(Exception):
    """The email provider did not do what we needed; the request can be retried."""


class SubscriberStore(Protocol):
    async def insert_pending(self, values: dict[str, Any]) -> str | None: ...
    async def get(
        self, subscriber_id: str, *, lock: bool = False
    ) -> SubscriberRecord | None: ...
    async def get_by_email(
        self, email: str, *, lock: bool = False
    ) -> SubscriberRecord | None: ...
    async def update(self, subscriber_id: str, values: dict[str, Any]) -> None: ...


class Committer(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


@dataclass(frozen=True)
class SubscribeRequest:
    """A validated sign-up. ``email`` is already trimmed and lower-cased."""

    email: str
    categories: tuple[str, ...]
    frequency: AlertFrequency
    consent_text: str
    consent_source: str


def _utcnow() -> datetime:
    return datetime.now(UTC)


class SubscriberService:
    def __init__(
        self,
        store: SubscriberStore,
        session: Committer,
        provider: EmailProvider,
        tokens: SubscriberTokens,
        site_url: str,
        brand: str,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._store = store
        self._session = session
        self._provider = provider
        self._tokens = tokens
        self._site_url = site_url.rstrip("/")
        self._brand = brand
        self._clock = clock

    async def subscribe(self, request: SubscribeRequest) -> None:
        """Record the sign-up as PENDING and email a confirmation link, unless throttled or confirmed."""
        now = self._clock()
        values = {
            "categories": list(request.categories),
            "frequency": request.frequency,
            "consent_text": request.consent_text,
            "consent_at": now,
            "consent_source": request.consent_source,
        }
        subscriber_id = await self._store.insert_pending(
            {"email": request.email, **values}
        )
        if subscriber_id is None:
            subscriber_id = await self._reopen(request.email, values, now)
            if subscriber_id is None:
                await self._session.rollback()
                return
        confirm_token = self._tokens.issue(
            TokenPurpose.CONFIRM, subscriber_id, now + CONFIRM_TOKEN_TTL
        )
        await self._store.update(
            subscriber_id,
            {
                "confirmation_token_hash": token_digest(confirm_token),
                "confirmation_sent_at": now,
            },
        )
        unsubscribe_token = self._tokens.issue(
            TokenPurpose.UNSUBSCRIBE, subscriber_id, None
        )
        try:
            await self._provider.send(
                confirmation_message(
                    request.email,
                    self._brand,
                    self._link("confirm", confirm_token),
                    self._link("unsubscribe", unsubscribe_token),
                    self._link("unsubscribe/one-click", unsubscribe_token),
                )
            )
        except EmailProviderError as exc:
            await self._session.rollback()
            logger.error("confirmation email failed: %s", exc)
            raise ProviderUnavailable from None
        await self._session.commit()

    async def _reopen(
        self, email: str, values: dict[str, Any], now: datetime
    ) -> str | None:
        """The address already has a row: its id when a new confirmation may go out, else None.

        Only a PENDING row is re-opened. A CONFIRMED subscriber is never changed, and an UNSUBSCRIBED
        address is never re-opened by an anonymous submission (anyone can type it): bringing it back is an
        operator action. A re-sent confirmation keeps the first request's consent record, so the 30 day
        retention of an unconfirmed sign-up ages from the first request and cannot be extended by resubmitting.
        Once that record is past the retention period (the row is only waiting for the purge) a resubmission
        starts it afresh, exactly as if the purge had run and the visitor had signed up again.
        """
        existing = await self._store.get_by_email(email, lock=True)
        if existing is None or existing.status is not SubscriberStatus.PENDING:
            return None
        sent = existing.confirmation_sent_at
        if sent is not None and now - sent < RESEND_INTERVAL:
            return None
        changes = (
            values
            if now - existing.consent_at >= PENDING_RETENTION
            else {"categories": values["categories"], "frequency": values["frequency"]}
        )
        await self._store.update(existing.id, changes)
        return existing.id

    async def confirm(self, token: str) -> None:
        """PENDING to CONFIRMED and onto the provider's list. Raises ``InvalidToken``."""
        now = self._clock()
        subscriber_id = self._tokens.verify(token, TokenPurpose.CONFIRM, now)
        if subscriber_id is None:
            raise InvalidToken
        record = await self._store.get(subscriber_id, lock=True)
        stored = record.confirmation_token_hash if record else None
        sent = record.confirmation_sent_at if record else None
        if (
            record is None
            or record.status is not SubscriberStatus.PENDING
            or stored is None
            or sent is None
            or now - sent >= CONFIRM_TOKEN_TTL
            or not hmac.compare_digest(stored, token_digest(token))
        ):
            await self._session.rollback()
            raise InvalidToken
        try:
            provider_id = await self._provider.upsert_contact(
                ContactDetails(record.email, record.categories, record.frequency.value)
            )
        except EmailProviderError as exc:
            await self._session.rollback()
            logger.error("subscriber sync failed on confirm: %s", exc)
            raise ProviderUnavailable from None
        await self._store.update(
            record.id,
            {
                "status": SubscriberStatus.CONFIRMED,
                "confirmed_at": now,
                "confirmation_token_hash": None,
                "provider_subscriber_id": provider_id or record.provider_subscriber_id,
            },
        )
        await self._session.commit()

    async def unsubscribe(self, token: str) -> None:
        """Mark UNSUBSCRIBED, keep only the suppression row, and erase the provider contact. Idempotent.

        The local change is committed first, so we never mail the address again from our side even if
        the provider is down; the provider call is repeated on every retry until it succeeds.
        Only ``email``, ``status``, the consent record and ``unsubscribed_at`` survive (platform-models.md).
        """
        now = self._clock()
        subscriber_id = self._tokens.verify(token, TokenPurpose.UNSUBSCRIBE, now)
        if subscriber_id is None:
            raise InvalidToken
        record = await self._store.get(subscriber_id, lock=True)
        if record is None:
            # A genuine token for a row retention already removed: the address is gone, as asked.
            await self._session.rollback()
            return
        if record.status is not SubscriberStatus.UNSUBSCRIBED:
            await self._store.update(
                record.id,
                {
                    "status": SubscriberStatus.UNSUBSCRIBED,
                    "unsubscribed_at": now,
                    "confirmation_token_hash": None,
                    "categories": [],
                    "provider_subscriber_id": None,
                },
            )
        await self._session.commit()
        try:
            await self._provider.delete_contact(
                record.provider_subscriber_id, record.email
            )
        except EmailProviderError as exc:
            logger.error(
                "subscriber sync failed on unsubscribe: subscriber=%s %s",
                record.id,
                exc,
            )
            raise ProviderUnavailable from None

    def _link(self, path: str, token: str) -> str:
        return f"{self._site_url}/alerts/{path}?token={token}"
