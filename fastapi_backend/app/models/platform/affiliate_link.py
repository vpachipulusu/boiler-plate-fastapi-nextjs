from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.mixins import IdMixin, TimestampMixin


class AffiliateLink(IdMixin, TimestampMixin, Base):
    """A tracked destination for an offer. The browser never sees `destination_url`."""

    __tablename__ = "affiliate_links"
    __table_args__ = (
        Index("ix_affiliate_links_offer_id_active", "offer_id", "active"),
    )

    offer_id: Mapped[str] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"))
    # The affiliate network or programme (for example "awin", "direct").
    provider: Mapped[str]
    destination_url: Mapped[str]
    tracking_id: Mapped[str | None]
    active: Mapped[bool] = mapped_column(server_default=text("true"))
