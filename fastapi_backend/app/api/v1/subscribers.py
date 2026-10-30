"""Alerts sign-up: ``POST /v1/subscribers`` and the confirm and unsubscribe steps.

Called only by the Next.js server (internal key). Three rules shape the API (details and reasons in
``docs/developer/backend-subscribers.md``):

* ``POST /v1/subscribers`` answers 202 with the same body whatever the address's state, and is limited per
  client IP and per hashed address.
* Confirm is a POST, not the GET the story first described: a link in an email is fetched by security
  scanners and mail previews, so a state change on GET would confirm people who never clicked, and a token in
  a query string lands in request logs.
* Every bad token gets the same 400, whether forged, expired, used or for the wrong purpose.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_internal_key
from app.api.deps import EmailProviderDep, SessionDep, get_session_provider
from app.api.rate_limit import (
    RATE_LIMIT_FAIL_CLOSED_RESPONSES,
    RATE_LIMIT_RESPONSES,
    limit_by_client_ip,
    limit_by_client_ip_and_email,
)
from app.core.config import LOCAL_ENVIRONMENTS, settings
from app.core.database import SessionProvider
from app.core.errors import ErrorResponse
from app.core.rate_limit import (
    SUBSCRIBE_EMAIL_POLICY,
    SUBSCRIBE_IP_POLICY,
    SUBSCRIBER_TOKEN_POLICY,
)
from app.core.subscriber_tokens import MAX_TOKEN_LENGTH, SubscriberTokens
from app.models.platform.email_subscriber import AlertFrequency
from app.repositories.subscribers import SubscriberRepository
from app.services.subscriber_delivery import ConfirmationDelivery
from app.services.subscribers import (
    InvalidToken,
    ProviderUnavailable,
    SubscribeRequest,
    SubscriberService,
)

MAX_EMAIL_LENGTH = 254
MAX_CATEGORIES = 20
MAX_SLUG_LENGTH = 100
MAX_CONSENT_LENGTH = 1000
INVALID_LINK_MESSAGE = "Invalid or expired link"
UNAVAILABLE_MESSAGE = "Service temporarily unavailable"
RETRY_AFTER_SECONDS = "5"
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"

Slug = Annotated[
    str, Field(min_length=1, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
]


class SubscribeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=MAX_EMAIL_LENGTH)
    categories: list[Slug] = Field(min_length=1, max_length=MAX_CATEGORIES)
    frequency: Literal["DAILY", "WEEKLY"]
    consent: Literal[True] = Field(description="The box was ticked; always true")
    consent_text: str = Field(
        min_length=1,
        max_length=MAX_CONSENT_LENGTH,
        description="The exact wording shown",
    )
    consent_source: Literal["alerts_page"]

    @field_validator("email", mode="after")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        # ASCII only: Python's and Postgres's lower() disagree on some other characters, which would
        # trip the table's lower-case CHECK (platform-models.md).
        if not value.isascii():
            raise ValueError("email must be ASCII")
        return value.strip().lower()

    @field_validator("categories", mode="after")
    @classmethod
    def drop_duplicate_categories(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class TokenBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=MAX_TOKEN_LENGTH)


class SubscribeAccepted(BaseModel):
    status: Literal["accepted"] = "accepted"


class SubscribeResponse(BaseModel):
    success: Literal[True] = True
    data: SubscribeAccepted = SubscribeAccepted()


class ConfirmedData(BaseModel):
    status: Literal["confirmed"] = "confirmed"


class ConfirmResponse(BaseModel):
    success: Literal[True] = True
    data: ConfirmedData = ConfirmedData()


class UnsubscribedData(BaseModel):
    status: Literal["unsubscribed"] = "unsubscribed"


class UnsubscribeResponse(BaseModel):
    success: Literal[True] = True
    data: UnsubscribedData = UnsubscribedData()


def subscribe_email(body: SubscribeBody) -> str:
    """The normalised address, for the per-address rate limit (FastAPI reads the body once)."""
    return str(body.email)


def get_subscriber_service(
    session: SessionDep, provider: EmailProviderDep
) -> SubscriberService:
    secret = settings.SUBSCRIBER_TOKEN_SECRET
    if secret is None:
        raise HTTPException(
            503, UNAVAILABLE_MESSAGE, {"Retry-After": RETRY_AFTER_SECONDS}
        )
    return SubscriberService(
        SubscriberRepository(session),
        session,
        provider,
        SubscriberTokens(secret.get_secret_value().encode()),
        settings.PUBLIC_SITE_URL,
        settings.EMAIL_FROM_NAME,
    )


ServiceDep = Annotated[SubscriberService, Depends(get_subscriber_service)]


def get_confirmation_delivery(
    provider: EmailProviderDep,
    sessions: Annotated[SessionProvider, Depends(get_session_provider)],
) -> ConfirmationDelivery:
    """Sends the confirmation after the response. Withdrawing a failed claim needs a session of its own:
    the request's session is closed by then.
    """

    @asynccontextmanager
    async def unit_of_work() -> AsyncIterator[
        tuple[SubscriberRepository, AsyncSession]
    ]:
        async with sessions.session() as session:
            yield SubscriberRepository(session), session

    return ConfirmationDelivery(provider, unit_of_work)


DeliveryDep = Annotated[ConfirmationDelivery, Depends(get_confirmation_delivery)]


def _unavailable() -> HTTPException:
    return HTTPException(503, UNAVAILABLE_MESSAGE, {"Retry-After": RETRY_AFTER_SECONDS})


def require_email_delivery() -> None:
    """Refuse sign-ups in production while no provider is set: nobody should be told to check an inbox
    for a message that will never come. Local and test runs accept them (nothing is sent).
    """
    # ENVIRONMENT only: a Vercel preview is a deployed site, not a local run.
    if not settings.EMAIL_PROVIDER and settings.ENVIRONMENT not in LOCAL_ENVIRONMENTS:
        raise _unavailable()


router = APIRouter(
    prefix="/v1/subscribers",
    tags=["subscribers"],
    dependencies=[Depends(require_internal_key)],
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)


@router.post(
    "",
    status_code=202,
    response_model=SubscribeResponse,
    summary="Start an alerts sign-up",
    dependencies=[
        Depends(require_email_delivery),
        Depends(
            limit_by_client_ip_and_email(
                SUBSCRIBE_IP_POLICY, SUBSCRIBE_EMAIL_POLICY, subscribe_email
            )
        ),
    ],
    responses=RATE_LIMIT_FAIL_CLOSED_RESPONSES,
)
async def subscribe_to_alerts(
    body: SubscribeBody,
    service: ServiceDep,
    delivery: DeliveryDep,
    background: BackgroundTasks,
    response: Response,
) -> SubscribeResponse:
    """Store a PENDING sign-up and email a confirmation link.

    The answer is identical for a new address, a pending one, a confirmed one and an unsubscribed one, and
    a confirmation is re-sent at most once an hour. Nothing says whether an email went out.
    """
    # The email is sent after the response (FREEJ-32), so no answer waits on the provider. A provider outage is
    # not visible here either: it is logged and the claim withdrawn, so the visitor can submit again at once.
    response.headers["Cache-Control"] = "no-store"
    pending = await service.subscribe(
        SubscribeRequest(
            email=str(body.email),
            categories=tuple(body.categories),
            frequency=AlertFrequency(body.frequency),
            consent_text=body.consent_text,
            consent_source=body.consent_source,
        )
    )
    if pending is not None:
        background.add_task(delivery.deliver, pending)
    return SubscribeResponse()


@router.post(
    "/confirm",
    response_model=ConfirmResponse,
    summary="Confirm an alerts sign-up",
    dependencies=[Depends(limit_by_client_ip(SUBSCRIBER_TOKEN_POLICY))],
    responses={400: {"model": ErrorResponse}, **RATE_LIMIT_RESPONSES},
)
async def confirm_alert_subscription(
    body: TokenBody, service: ServiceDep, response: Response
) -> ConfirmResponse:
    """PENDING to CONFIRMED. A forged, expired, used or wrong-purpose token is the same 400."""
    response.headers["Cache-Control"] = "no-store"
    try:
        await service.confirm(body.token)
    except InvalidToken:
        raise HTTPException(400, INVALID_LINK_MESSAGE) from None
    except ProviderUnavailable:
        raise _unavailable() from None
    return ConfirmResponse()


@router.post(
    "/unsubscribe",
    response_model=UnsubscribeResponse,
    summary="Unsubscribe from alerts",
    dependencies=[Depends(limit_by_client_ip(SUBSCRIBER_TOKEN_POLICY))],
    responses={400: {"model": ErrorResponse}, **RATE_LIMIT_RESPONSES},
)
async def unsubscribe_from_alerts(
    body: TokenBody, service: ServiceDep, response: Response
) -> UnsubscribeResponse:
    """Idempotent: unsubscribing twice succeeds twice. Used by the page and by one-click POSTs."""
    response.headers["Cache-Control"] = "no-store"
    try:
        await service.unsubscribe(body.token)
    except InvalidToken:
        raise HTTPException(400, INVALID_LINK_MESSAGE) from None
    except ProviderUnavailable:
        raise _unavailable() from None
    return UnsubscribeResponse()
