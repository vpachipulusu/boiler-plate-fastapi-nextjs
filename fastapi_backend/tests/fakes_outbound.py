"""Test doubles for the outbound click: a recording click store and committer."""

from collections.abc import Sequence
from typing import Any

from app.models.platform.click_event import UserAgentClass
from app.repositories.outbound_clicks import LinkRecord


def make_link(**overrides: Any) -> LinkRecord:
    values: dict[str, Any] = {
        "id": "link_1",
        "provider": "awin",
        "destination_url": "https://www.awin1.com/cread.php?awinmid=1&awinaffid=2",
        "merchant_website": "https://www.acme.example",
    }
    return LinkRecord(**{**values, **overrides})


class FakeClickStore:
    """Canned active links; remembers every click it was asked to write."""

    def __init__(self, links: Sequence[LinkRecord] = ()) -> None:
        self.links = list(links)
        self.clicks: list[dict[str, Any]] = []
        self.asked: list[str] = []

    async def list_active_links(self, offer_id: str) -> Sequence[LinkRecord]:
        self.asked.append(offer_id)
        return self.links

    async def add_click(
        self,
        *,
        offer_id: str,
        affiliate_link_id: str,
        referrer_host: str | None,
        user_agent_class: UserAgentClass | None,
    ) -> None:
        self.clicks.append(
            {
                "offer_id": offer_id,
                "affiliate_link_id": affiliate_link_id,
                "referrer_host": referrer_host,
                "user_agent_class": user_agent_class,
            }
        )


class FakeCommitter:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1
