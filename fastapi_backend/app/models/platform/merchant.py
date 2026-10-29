from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.mixins import IdMixin, TimestampMixin


class Merchant(IdMixin, TimestampMixin, Base):
    """The brand or retailer that runs an offer."""

    __tablename__ = "merchants"

    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    website: Mapped[str | None]
    # Null until a licensed logo exists; the UI then shows the name as text.
    logo_url: Mapped[str | None]
    active: Mapped[bool] = mapped_column(server_default=text("true"))
