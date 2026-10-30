"""Reads the links of an offer and writes click events for the outbound redirect.

A click event holds only what ``ClickEvent`` allows: the offer, the link that was followed, a
minute-truncated time (database default), a referrer host and a coarse user-agent class.
"""

from dataclasses import dataclass

from sqlalchemy import select

from app.models.platform.affiliate_link import AffiliateLink
from app.models.platform.click_event import ClickEvent, UserAgentClass
from app.models.platform.merchant import Merchant
from app.models.platform.offer import Offer
from app.repositories.base import BaseRepository


@dataclass(frozen=True)
class LinkRecord:
    """An active affiliate link plus the website of the merchant it belongs to."""

    id: str
    provider: str
    destination_url: str
    merchant_website: str | None


class OutboundClickRepository(BaseRepository):
    async def list_active_links(self, offer_id: str) -> list[LinkRecord]:
        """Active links of the offer, oldest first so the choice is stable."""
        statement = (
            select(
                AffiliateLink.id,
                AffiliateLink.provider,
                AffiliateLink.destination_url,
                Merchant.website.label("merchant_website"),
            )
            .select_from(AffiliateLink)
            .join(Offer, Offer.id == AffiliateLink.offer_id)
            .join(Merchant, Merchant.id == Offer.merchant_id)
            .where(AffiliateLink.offer_id == offer_id, AffiliateLink.active.is_(True))
            .order_by(AffiliateLink.created_at, AffiliateLink.id)
        )
        rows = (await self._session.execute(statement)).mappings().all()
        return [LinkRecord(**row) for row in rows]

    async def add_click(
        self,
        *,
        offer_id: str,
        affiliate_link_id: str,
        referrer_host: str | None,
        user_agent_class: UserAgentClass | None,
    ) -> None:
        """Insert one click event. The caller commits."""
        self._session.add(
            ClickEvent(
                offer_id=offer_id,
                affiliate_link_id=affiliate_link_id,
                referrer_host=referrer_host,
                user_agent_class=user_agent_class,
            )
        )
        await self._session.flush()
