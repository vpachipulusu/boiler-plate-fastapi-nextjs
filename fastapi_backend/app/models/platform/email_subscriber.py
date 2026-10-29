import enum
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.enums import enum_check, enum_column
from app.models.platform.mixins import IdMixin, TimestampMixin


class SubscriberStatus(enum.StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    UNSUBSCRIBED = "UNSUBSCRIBED"


class AlertFrequency(enum.StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


class EmailSubscriber(IdMixin, TimestampMixin, Base):
    """A double opt-in subscriber to new-offer alerts."""

    __tablename__ = "email_subscribers"
    __table_args__ = (
        # No citext: the service lower-cases before writing and the database enforces it.
        CheckConstraint("email = lower(email)", name="email_lowercase"),
        enum_check("status", SubscriberStatus),
        enum_check("frequency", AlertFrequency),
    )

    email: Mapped[str] = mapped_column(unique=True)
    status: Mapped[SubscriberStatus] = mapped_column(
        enum_column(SubscriberStatus),
        server_default=SubscriberStatus.PENDING.value,
    )
    # Category slugs the subscriber wants alerts for.
    categories: Mapped[list[Any]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    frequency: Mapped[AlertFrequency] = mapped_column(enum_column(AlertFrequency))
    # Proof of consent: the exact wording shown, when, and on which form.
    consent_text: Mapped[str]
    consent_at: Mapped[datetime]
    consent_source: Mapped[str]
    confirmed_at: Mapped[datetime | None]
    unsubscribed_at: Mapped[datetime | None]
    provider_subscriber_id: Mapped[str | None]
    # Only a hash of the confirmation token is stored, never the token itself.
    confirmation_token_hash: Mapped[str | None] = mapped_column(unique=True)
    # Anchor for the token's 24 hour expiry.
    confirmation_sent_at: Mapped[datetime | None]
