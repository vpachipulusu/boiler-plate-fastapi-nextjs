"""Test doubles for the alerts sign-up: an in-memory store, a committer, a mutable clock and helpers."""

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.email_provider import FakeEmailProvider
from app.core.ids import new_id
from app.core.subscriber_tokens import SubscriberTokens
from app.models.platform.email_subscriber import AlertFrequency, SubscriberStatus
from app.repositories.subscribers import SubscriberRecord
from app.services.subscribers import SubscribeRequest, SubscriberService

NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
SECRET = b"test-only-subscriber-token-secret-0123456789"
SITE = "https://freejoy.test"
LINK = re.compile(r"https://freejoy\.test/alerts/([a-z/-]+)\?token=([A-Za-z0-9_.-]+)")


class FakeClock:
    def __init__(self, now: datetime = NOW) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


class FakeCommitter:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


class FakeSubscriberStore:
    """Dict-backed store with the repository's behaviour. A rollback restores the last commit."""

    def __init__(self, committer: FakeCommitter | None = None) -> None:
        self.rows: dict[str, SubscriberRecord] = {}
        self.committer = committer or FakeCommitter()
        self._committed: dict[str, SubscriberRecord] = {}

    async def insert_pending(self, values: dict[str, Any]) -> str | None:
        if any(row.email == values["email"] for row in self.rows.values()):
            return None
        subscriber_id = new_id()
        self.rows[subscriber_id] = SubscriberRecord(
            id=subscriber_id,
            email=values["email"],
            status=SubscriberStatus.PENDING,
            categories=tuple(values["categories"]),
            frequency=values["frequency"],
            consent_at=values["consent_at"],
            confirmed_at=None,
            unsubscribed_at=None,
            provider_subscriber_id=None,
            confirmation_token_hash=None,
            confirmation_sent_at=None,
        )
        return subscriber_id

    async def get(
        self, subscriber_id: str, *, lock: bool = False
    ) -> SubscriberRecord | None:
        return self.rows.get(subscriber_id)

    async def get_by_email(
        self, email: str, *, lock: bool = False
    ) -> SubscriberRecord | None:
        return next((r for r in self.rows.values() if r.email == email), None)

    async def update(self, subscriber_id: str, values: dict[str, Any]) -> None:
        changes = dict(values)
        if "categories" in changes:
            changes["categories"] = tuple(changes["categories"])
        changes.pop("consent_text", None)
        changes.pop("consent_source", None)
        self.rows[subscriber_id] = replace(self.rows[subscriber_id], **changes)


class CommitTrackingStore(FakeSubscriberStore):
    """Makes ``rollback`` discard uncommitted changes, like a database transaction."""

    def __init__(self) -> None:
        committer = _TransactionCommitter(self)
        super().__init__(committer)


class _TransactionCommitter(FakeCommitter):
    def __init__(self, store: FakeSubscriberStore) -> None:
        super().__init__()
        self._store = store

    async def commit(self) -> None:
        await super().commit()
        self._store._committed = dict(self._store.rows)

    async def rollback(self) -> None:
        await super().rollback()
        self._store.rows = dict(self._store._committed)


def make_request(email: str = "sam@example.com", **overrides: Any) -> SubscribeRequest:
    base = SubscribeRequest(
        email=email,
        categories=("beauty", "pets"),
        frequency=AlertFrequency.WEEKLY,
        consent_text="I agree to receive freebie emails from Freejoy.",
        consent_source="alerts_page",
    )
    return replace(base, **overrides)


class Harness:
    """A service wired to fakes, plus the pieces a test inspects."""

    def __init__(self) -> None:
        self.store = CommitTrackingStore()
        self.provider = FakeEmailProvider()
        self.clock = FakeClock()
        self.tokens = SubscriberTokens(SECRET)
        self.service = SubscriberService(
            self.store,
            self.store.committer,
            self.provider,
            self.tokens,
            SITE,
            "Freejoy",
            self.clock,
        )

    @property
    def committer(self) -> FakeCommitter:
        return self.store.committer

    def last_links(self) -> dict[str, str]:
        """``{"confirm": token, "unsubscribe": token, "unsubscribe/one-click": token}`` of the last mail."""
        return link_tokens(self.provider.sent[-1].text)


def link_tokens(text: str) -> dict[str, str]:
    return {kind: token for kind, token in LINK.findall(text)}
