from datetime import datetime

from sqlalchemy import CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.mixins import IdMixin, TimestampMixin


class Organization(IdMixin, TimestampMixin, Base):
    """A team or tenant. Subscription state lives here, not on User."""

    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint("slug = lower(slug)", name="slug_lowercase"),
        CheckConstraint(
            "granted_plan IN ('pro', 'enterprise')", name="granted_plan_valid"
        ),
        CheckConstraint(
            "(granted_plan IS NULL) = (granted_until IS NULL)", name="grant_complete"
        ),
    )

    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)

    stripe_customer_id: Mapped[str | None] = mapped_column(unique=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(unique=True)
    stripe_price_id: Mapped[str | None]
    stripe_current_period_end: Mapped[datetime | None]
    # Stripe `created` time of the last subscription event applied; an
    # older event arriving later is ignored.
    stripe_subscription_event_at: Mapped[datetime | None]
    # Stripe's cancel_at_period_end (or a scheduled cancel_at); webhook-written.
    stripe_cancel_at_period_end: Mapped[bool] = mapped_column(
        server_default=text("false")
    )
    subscription_tier: Mapped[str] = mapped_column(server_default="free")
    subscription_status: Mapped[str] = mapped_column(server_default="inactive")

    # Complimentary plan set by a platform admin. Never written by the Stripe
    # webhook and never a Stripe object: the plan in force is the higher of
    # `subscription_tier` and an unexpired grant (`app.core.plans.effective_plan_key`).
    granted_plan: Mapped[str | None]
    granted_until: Mapped[datetime | None]
