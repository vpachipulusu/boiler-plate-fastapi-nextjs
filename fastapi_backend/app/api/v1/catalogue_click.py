"""Outbound click: ``POST /v1/catalogue/offers/{offer_id}/click``.

Called only by the Next.js ``/go/[offerId]`` route handler. It records one click event and
returns the stored affiliate destination, or refuses without writing anything:

* 404 ``Offer not found``: unknown, draft, archived, hidden, or no usable affiliate link. The
  body is identical for every one of these, so a caller cannot probe for unpublished offers.
* 410 ``This offer has ended``: only an offer that provably was public (same rule and body as
  ``GET /v1/catalogue/offers/{slug}``); the stub carries the slug so the caller can show the page.

Every response is ``Cache-Control: no-store``. The destination is never logged.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Response
from pydantic import BaseModel, ConfigDict, Field

from app.api.auth import require_internal_key
from app.api.deps import SessionDep
from app.api.rate_limit import RATE_LIMIT_RESPONSES, limit_by_client_ip
from app.api.v1.catalogue_schemas import ExpiredOfferResponse, expired_response
from app.core.config import settings
from app.core.errors import ErrorResponse
from app.core.rate_limit import OUTBOUND_CLICK_POLICY
from app.models.platform.click_event import UserAgentClass
from app.repositories.catalogue import CatalogueRepository
from app.repositories.outbound_clicks import OutboundClickRepository
from app.services.catalogue import CatalogueService, ExpiredOffer
from app.services.outbound_clicks import MAX_HOST_LENGTH, OutboundClickService

NO_STORE = {"Cache-Control": "no-store"}
OFFER_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"

router = APIRouter(
    prefix="/v1/catalogue",
    tags=["catalogue"],
    dependencies=[
        Depends(require_internal_key),
        Depends(limit_by_client_ip(OUTBOUND_CLICK_POLICY)),
    ],
    responses={**RATE_LIMIT_RESPONSES, 401: {"model": ErrorResponse}},
)


class ClickRequest(BaseModel):
    """What the Next.js route may tell the backend about the click. Nothing else is accepted."""

    model_config = ConfigDict(extra="forbid")

    referrer_host: Annotated[
        str | None,
        Field(
            max_length=MAX_HOST_LENGTH,
            description="Host name of the referring page; anything else is dropped",
        ),
    ] = None
    user_agent_class: UserAgentClass | None = Field(
        default=None,
        description="Coarse device class; the raw user agent is never sent",
    )


class ClickData(BaseModel):
    destination_url: str = Field(description="Stored https destination; never logged")


class ClickResponse(BaseModel):
    success: Literal[True] = True
    data: ClickData


def get_click_service(session: SessionDep) -> OutboundClickService:
    return OutboundClickService(
        CatalogueService(CatalogueRepository(session)),
        OutboundClickRepository(session),
        session,
        allow_sample_provider=settings.relaxed_environment,
    )


ClickServiceDep = Annotated[OutboundClickService, Depends(get_click_service)]


def _no_store(body: BaseModel, status_code: int = 200) -> Response:
    return Response(
        body.model_dump_json(),
        status_code=status_code,
        media_type="application/json",
        headers=NO_STORE,
    )


@router.post(
    "/offers/{offer_id}/click",
    response_model=ClickResponse,
    summary="Record an outbound click and return the destination",
    responses={
        404: {"model": ErrorResponse, "description": "Not available"},
        410: {"model": ExpiredOfferResponse, "description": "The offer has ended"},
    },
)
async def record_click(
    offer_id: Annotated[str, Path(pattern=OFFER_ID_PATTERN)],
    service: ClickServiceDep,
    body: Annotated[ClickRequest | None, Body()] = None,
) -> Response:
    """Write one click event for a live offer and return its affiliate destination."""
    request = body or ClickRequest()
    outcome = await service.record_click(
        offer_id, request.referrer_host, request.user_agent_class
    )
    if outcome is None:
        raise HTTPException(404, "Offer not found", headers=NO_STORE)
    if isinstance(outcome, ExpiredOffer):
        return _no_store(expired_response(outcome), 410)
    return _no_store(
        ClickResponse(data=ClickData(destination_url=outcome.destination_url))
    )
