"""Queries for alert subscribers (``email_subscribers``). No business rules live here.

Reads that precede a write take a row lock (``FOR UPDATE``) so two requests for the same address or the
same token cannot both act on the old state. Nothing here logs or returns more than the service needs.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.core.ids import new_id
from app.models.platform.email_subscriber import (
    AlertFrequency,
    EmailSubscriber,
    SubscriberStatus,
)
from app.repositories.base import BaseRepository


@dataclass(frozen=True)
class SubscriberRecord:
    id: str
    email: str
    status: SubscriberStatus
    categories: tuple[str, ...]
    frequency: AlertFrequency
    consent_at: datetime
    confirmed_at: datetime | None
    unsubscribed_at: datetime | None
    provider_subscriber_id: str | None
    confirmation_token_hash: str | None
    confirmation_sent_at: datetime | None


@dataclass(frozen=True)
class PurgeCandidate:
    id: str
    status: SubscriberStatus
    provider_subscriber_id: str | None


def _record(row: EmailSubscriber) -> SubscriberRecord:
    return SubscriberRecord(
        id=row.id,
        email=row.email,
        status=row.status,
        categories=tuple(str(slug) for slug in row.categories),
        frequency=row.frequency,
        consent_at=row.consent_at,
        confirmed_at=row.confirmed_at,
        unsubscribed_at=row.unsubscribed_at,
        provider_subscriber_id=row.provider_subscriber_id,
        confirmation_token_hash=row.confirmation_token_hash,
        confirmation_sent_at=row.confirmation_sent_at,
    )


def _expired(pending_before: datetime, unsubscribed_before: datetime) -> Any:
    """The rows retention removes: stale PENDING sign-ups and long-unsubscribed addresses."""
    return (
        (EmailSubscriber.status == SubscriberStatus.PENDING)
        & (EmailSubscriber.consent_at < pending_before)
    ) | (
        (EmailSubscriber.status == SubscriberStatus.UNSUBSCRIBED)
        & (EmailSubscriber.unsubscribed_at < unsubscribed_before)
    )


class SubscriberRepository(BaseRepository):
    async def insert_pending(self, values: Mapping[str, Any]) -> str | None:
        """Insert a new PENDING row; its id, or None when the address already has a row."""
        statement = (
            insert(EmailSubscriber)
            .values(id=new_id(), status=SubscriberStatus.PENDING, **values)
            .on_conflict_do_nothing(index_elements=["email"])
            .returning(EmailSubscriber.id)
        )
        return await self._session.scalar(statement)

    async def get(
        self, subscriber_id: str, *, lock: bool = False
    ) -> SubscriberRecord | None:
        statement = select(EmailSubscriber).where(EmailSubscriber.id == subscriber_id)
        return await self._one(statement, lock)

    async def get_by_email(
        self, email: str, *, lock: bool = False
    ) -> SubscriberRecord | None:
        statement = select(EmailSubscriber).where(EmailSubscriber.email == email)
        return await self._one(statement, lock)

    async def _one(self, statement: Any, lock: bool) -> SubscriberRecord | None:
        if lock:
            statement = statement.with_for_update()
        row = await self._session.scalar(statement)
        return _record(row) if row is not None else None

    async def update(self, subscriber_id: str, values: Mapping[str, Any]) -> None:
        await self._session.execute(
            update(EmailSubscriber)
            .where(EmailSubscriber.id == subscriber_id)
            .values(**values)
        )

    async def count_expired(
        self, pending_before: datetime, unsubscribed_before: datetime
    ) -> tuple[int, int]:
        """(stale pending, long unsubscribed) row counts, for a dry run."""
        counts = []
        for status, column, cutoff in (
            (SubscriberStatus.PENDING, EmailSubscriber.consent_at, pending_before),
            (
                SubscriberStatus.UNSUBSCRIBED,
                EmailSubscriber.unsubscribed_at,
                unsubscribed_before,
            ),
        ):
            counts.append(
                await self._session.scalar(
                    select(func.count())
                    .select_from(EmailSubscriber)
                    .where(EmailSubscriber.status == status, column < cutoff)
                )
                or 0
            )
        return counts[0], counts[1]

    async def list_expired(
        self,
        pending_before: datetime,
        unsubscribed_before: datetime,
        after_id: str,
        limit: int,
    ) -> list[PurgeCandidate]:
        """The next ``limit`` removable rows with an id above ``after_id`` (keyset paging)."""
        rows = await self._session.execute(
            select(
                EmailSubscriber.id,
                EmailSubscriber.status,
                EmailSubscriber.provider_subscriber_id,
            )
            .where(
                _expired(pending_before, unsubscribed_before),
                EmailSubscriber.id > after_id,
            )
            .order_by(EmailSubscriber.id)
            .limit(limit)
        )
        return [PurgeCandidate(*row) for row in rows.all()]

    async def delete_many(
        self,
        subscriber_ids: Sequence[str],
        pending_before: datetime,
        unsubscribed_before: datetime,
    ) -> int:
        """Delete the given rows that are still expired; the count is the rows really deleted.

        The retention test is applied again here, so a row that was confirmed or re-opened between listing
        and deleting survives.
        """
        result = await self._session.execute(
            delete(EmailSubscriber).where(
                EmailSubscriber.id.in_(subscriber_ids),
                _expired(pending_before, unsubscribed_before),
            )
        )
        return int(getattr(result, "rowcount", 0) or 0)
