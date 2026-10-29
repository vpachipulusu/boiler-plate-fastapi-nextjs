"""Admin merchants API: list, create, update, activate, deactivate.

Reads need ``offers.read`` (the offer editor picks a merchant); writes need ``merchants.write``.
``website`` and ``logo_url`` are validated as https URLs in ``AdminMerchantService``.
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import Depends, Query, Response
from pydantic import BaseModel, ConfigDict, model_validator

from app.api.admin import AuditorDep, require_admin
from app.api.deps import SessionDep
from app.api.v1.admin_catalogue_common import (
    ResourceId,
    SlugText,
    UrlText,
    admin_router,
    catalogue_http_error,
    line,
    no_store,
)
from app.core.permissions import AdminContext
from app.repositories.admin_merchants import AdminMerchantRepository, MerchantRecord
from app.services.admin_catalogue_common import MAX_PAGE_SIZE
from app.services.admin_catalogue_errors import CatalogueError
from app.services.admin_merchants import AdminMerchantService

router = admin_router("/v1/admin/merchants", "admin-merchants")

ReadAdmin = Annotated[AdminContext, Depends(require_admin("offers.read"))]
WriteAdmin = Annotated[AdminContext, Depends(require_admin("merchants.write"))]

Name = Annotated[str, line(120)]


class MerchantOut(BaseModel):
    id: str
    name: str
    slug: str
    website: str | None
    logo_url: str | None
    active: bool
    created_at: datetime
    updated_at: datetime


class MerchantsPage(BaseModel):
    merchants: list[MerchantOut]
    total_count: int
    limit: int
    offset: int


class MerchantsPageResponse(BaseModel):
    success: Literal[True] = True
    data: MerchantsPage


class MerchantResponse(BaseModel):
    success: Literal[True] = True
    data: MerchantOut


class CreateMerchantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    slug: SlugText | None = None
    website: UrlText | None = None
    logo_url: UrlText | None = None
    active: bool = True


class UpdateMerchantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    website: UrlText | None = None
    logo_url: UrlText | None = None

    @model_validator(mode="after")
    def supply_values(self) -> "UpdateMerchantRequest":
        if not self.model_fields_set:
            raise ValueError("Supply at least one field")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("The name cannot be null")
        return self


def get_merchant_service(
    session: SessionDep, auditor: AuditorDep
) -> AdminMerchantService:
    return AdminMerchantService(AdminMerchantRepository(session), session, auditor)


ServiceDep = Annotated[AdminMerchantService, Depends(get_merchant_service)]


def _out(record: MerchantRecord) -> MerchantOut:
    return MerchantOut(**record.__dict__)


@router.get("", response_model=MerchantsPageResponse)
async def admin_list_merchants(
    response: Response,
    _admin: ReadAdmin,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 50,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    active: bool | None = None,
) -> MerchantsPageResponse:
    no_store(response)
    page = await service.list_merchants(search, active, limit, offset)
    return MerchantsPageResponse(
        data=MerchantsPage(
            merchants=[_out(item) for item in page.merchants],
            total_count=page.total_count,
            limit=limit,
            offset=offset,
        )
    )


@router.post("", response_model=MerchantResponse, status_code=201)
async def admin_create_merchant(
    body: CreateMerchantRequest,
    response: Response,
    admin: WriteAdmin,
    service: ServiceDep,
) -> MerchantResponse:
    no_store(response)
    try:
        created = await service.create_merchant(admin, body.model_dump())
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return MerchantResponse(data=_out(created))


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def admin_read_merchant(
    merchant_id: ResourceId, response: Response, _admin: ReadAdmin, service: ServiceDep
) -> MerchantResponse:
    no_store(response)
    try:
        return MerchantResponse(data=_out(await service.get_merchant(merchant_id)))
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None


@router.patch("/{merchant_id}", response_model=MerchantResponse)
async def admin_update_merchant(
    merchant_id: ResourceId,
    body: UpdateMerchantRequest,
    response: Response,
    admin: WriteAdmin,
    service: ServiceDep,
) -> MerchantResponse:
    no_store(response)
    try:
        updated = await service.update_merchant(
            admin, merchant_id, body.model_dump(exclude_unset=True)
        )
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return MerchantResponse(data=_out(updated))


@router.post("/{merchant_id}/activate", response_model=MerchantResponse)
async def admin_activate_merchant(
    merchant_id: ResourceId, response: Response, admin: WriteAdmin, service: ServiceDep
) -> MerchantResponse:
    no_store(response)
    try:
        updated = await service.set_active(admin, merchant_id, True)
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return MerchantResponse(data=_out(updated))


@router.post("/{merchant_id}/deactivate", response_model=MerchantResponse)
async def admin_deactivate_merchant(
    merchant_id: ResourceId, response: Response, admin: WriteAdmin, service: ServiceDep
) -> MerchantResponse:
    no_store(response)
    try:
        updated = await service.set_active(admin, merchant_id, False)
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return MerchantResponse(data=_out(updated))
