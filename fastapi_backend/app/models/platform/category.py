from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.models.platform.mixins import IdMixin, TimestampMixin


class Category(IdMixin, TimestampMixin, Base):
    """A browsable group of offers (for example "Beauty & personal care")."""

    __tablename__ = "categories"

    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    # Short label for chips and the mobile grid ("Home" for "Home & cleaning").
    short_name: Mapped[str]
    description: Mapped[str]
    # Landing-page intro copy.
    intro: Mapped[str]
    # Pastel tint key used by the illustrated placeholders (a frontend design token).
    tint: Mapped[str]
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    enabled: Mapped[bool] = mapped_column(server_default=text("true"))
