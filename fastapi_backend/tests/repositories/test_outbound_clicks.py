"""OutboundClickRepository: the link query it builds and the click row it adds."""

from typing import Any

from sqlalchemy.dialects import postgresql

from app.models.platform.click_event import ClickEvent, UserAgentClass
from app.repositories.outbound_clicks import LinkRecord, OutboundClickRepository
from tests.fakes_catalogue import RowsSession


class RecordingSession(RowsSession):
    def __init__(self, *answers: tuple[list[dict[str, Any]], Any]) -> None:
        super().__init__(*answers)
        self.added: list[Any] = []
        self.flushes = 0

    def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def flush(self) -> None:
        self.flushes += 1


async def test_active_links_are_selected_for_one_offer_with_the_merchant_website() -> (
    None
):
    row = {
        "id": "link_1",
        "provider": "awin",
        "destination_url": "https://www.awin1.com/x",
        "merchant_website": "https://acme.example",
    }
    session = RecordingSession(([row], 1))

    links = await OutboundClickRepository(session).list_active_links("offer_1")  # type: ignore[arg-type]

    assert links == [LinkRecord(**row)]
    compiled = session.executed[0].compile(dialect=postgresql.dialect())
    sql = str(compiled)
    assert "affiliate_links.offer_id = %(offer_id_1)s" in sql
    assert "affiliate_links.active IS true" in sql
    assert "ORDER BY affiliate_links.created_at, affiliate_links.id" in sql
    assert compiled.params["offer_id_1"] == "offer_1"


async def test_add_click_adds_exactly_one_event_with_only_the_coarse_fields() -> None:
    session = RecordingSession()

    await OutboundClickRepository(session).add_click(  # type: ignore[arg-type]
        offer_id="offer_1",
        affiliate_link_id="link_1",
        referrer_host="news.example",
        user_agent_class=UserAgentClass.DESKTOP,
    )

    assert session.flushes == 1
    [event] = session.added
    assert isinstance(event, ClickEvent)
    assert (event.offer_id, event.affiliate_link_id) == ("offer_1", "link_1")
    assert event.referrer_host == "news.example"
    assert event.user_agent_class is UserAgentClass.DESKTOP
    # The time is left to the database default, which truncates to the minute.
    assert event.occurred_at is None
