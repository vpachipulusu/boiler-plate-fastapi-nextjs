import enum
from datetime import datetime

from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.enums import enum_check, enum_column
from app.models.platform.mixins import IdMixin


class UserAgentClass(enum.StrEnum):
    DESKTOP = "DESKTOP"
    MOBILE = "MOBILE"
    TABLET = "TABLET"
    BOT = "BOT"
    OTHER = "OTHER"


class ClickEvent(IdMixin, Base):
    """One outbound click on an offer.

    Privacy rule: this table holds no IP address, cookie id, user id, email or session
    id, and no raw user agent. Only the coarse `user_agent_class` and the referrer host
    are kept, so a click can be counted but never tied to a person.
    `tests/models/test_platform_metadata.py` fails if such a column is added.
    """

    __tablename__ = "click_events"
    __table_args__ = (
        Index("ix_click_events_offer_id_occurred_at", "offer_id", "occurred_at"),
        enum_check("user_agent_class", UserAgentClass),
    )

    offer_id: Mapped[str] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"))
    affiliate_link_id: Mapped[str | None] = mapped_column(
        ForeignKey("affiliate_links.id", ondelete="SET NULL")
    )
    occurred_at: Mapped[datetime] = mapped_column(server_default=func.now())
    referrer_host: Mapped[str | None]
    user_agent_class: Mapped[UserAgentClass | None] = mapped_column(
        enum_column(UserAgentClass)
    )
