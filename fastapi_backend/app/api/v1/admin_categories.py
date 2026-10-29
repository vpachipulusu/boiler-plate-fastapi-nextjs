"""Admin categories API: list, create, update, enable, disable.

Reads need ``offers.read`` (the offer editor picks a category); writes need ``categories.write``.
Every write stages its audit row in the same transaction (``AdminCategoryService``).
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.api.admin import AuditorDep, require_admin
from app.api.deps import SessionDep
from app.api.v1.admin_catalogue_common import (
    ResourceId,
    SlugText,
    TintText,
    admin_router,
    catalogue_http_error,
    line,
    no_store,
    paragraph,
)
from app.core.permissions import AdminContext
from app.repositories.admin_categories import AdminCategoryRepository, CategoryRecord
from app.services.admin_catalogue_common import MAX_PAGE_SIZE
from app.services.admin_catalogue_errors import CatalogueError
from app.services.admin_categories import AdminCategoryService

router = admin_router("/v1/admin/categories", "admin-categories")

ReadAdmin = Annotated[AdminContext, Depends(require_admin("offers.read"))]
WriteAdmin = Annotated[AdminContext, Depends(require_admin("categories.write"))]

Name = Annotated[str, line(80)]
ShortName = Annotated[str, line(40)]
Description = Annotated[str, paragraph(300)]
Intro = Annotated[str, paragraph(1000)]


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    short_name: str
    description: str
    intro: str
    tint: str
    sort_order: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


class CategoriesPage(BaseModel):
    categories: list[CategoryOut]
    total_count: int
    limit: int
    offset: int


class CategoriesPageResponse(BaseModel):
    success: Literal[True] = True
    data: CategoriesPage


class CategoryResponse(BaseModel):
    success: Literal[True] = True
    data: CategoryOut


class CreateCategoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    slug: SlugText | None = None
    short_name: ShortName
    description: Description
    intro: Intro
    tint: TintText
    sort_order: int = Field(default=0, ge=0, le=10_000)
    enabled: bool = True


class UpdateCategoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    short_name: ShortName | None = None
    description: Description | None = None
    intro: Intro | None = None
    tint: TintText | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)

    @model_validator(mode="after")
    def supply_values(self) -> "UpdateCategoryRequest":
        sent = {name: getattr(self, name) for name in self.model_fields_set}
        if not sent or any(value is None for value in sent.values()):
            raise ValueError("Supply at least one field, and no nulls")
        return self


def get_category_service(
    session: SessionDep, auditor: AuditorDep
) -> AdminCategoryService:
    return AdminCategoryService(AdminCategoryRepository(session), session, auditor)


ServiceDep = Annotated[AdminCategoryService, Depends(get_category_service)]


def _out(record: CategoryRecord) -> CategoryOut:
    return CategoryOut(**record.__dict__)


@router.get("", response_model=CategoriesPageResponse)
async def admin_list_categories(
    response: Response,
    _admin: ReadAdmin,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 50,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    enabled: bool | None = None,
) -> CategoriesPageResponse:
    no_store(response)
    page = await service.list_categories(search, enabled, limit, offset)
    return CategoriesPageResponse(
        data=CategoriesPage(
            categories=[_out(item) for item in page.categories],
            total_count=page.total_count,
            limit=limit,
            offset=offset,
        )
    )


@router.post("", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    body: CreateCategoryRequest,
    response: Response,
    admin: WriteAdmin,
    service: ServiceDep,
) -> CategoryResponse:
    no_store(response)
    try:
        created = await service.create_category(admin, body.model_dump())
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return CategoryResponse(data=_out(created))


@router.get("/{category_id}", response_model=CategoryResponse)
async def admin_read_category(
    category_id: ResourceId, response: Response, _admin: ReadAdmin, service: ServiceDep
) -> CategoryResponse:
    no_store(response)
    try:
        return CategoryResponse(data=_out(await service.get_category(category_id)))
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None


@router.patch("/{category_id}", response_model=CategoryResponse)
async def admin_update_category(
    category_id: ResourceId,
    body: UpdateCategoryRequest,
    response: Response,
    admin: WriteAdmin,
    service: ServiceDep,
) -> CategoryResponse:
    no_store(response)
    try:
        updated = await service.update_category(
            admin, category_id, body.model_dump(exclude_unset=True)
        )
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return CategoryResponse(data=_out(updated))


@router.post("/{category_id}/enable", response_model=CategoryResponse)
async def admin_enable_category(
    category_id: ResourceId, response: Response, admin: WriteAdmin, service: ServiceDep
) -> CategoryResponse:
    no_store(response)
    try:
        updated = await service.set_enabled(admin, category_id, True)
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return CategoryResponse(data=_out(updated))


@router.post("/{category_id}/disable", response_model=CategoryResponse)
async def admin_disable_category(
    category_id: ResourceId, response: Response, admin: WriteAdmin, service: ServiceDep
) -> CategoryResponse:
    no_store(response)
    try:
        updated = await service.set_enabled(admin, category_id, False)
    except CatalogueError as exc:
        raise catalogue_http_error(exc) from None
    return CategoryResponse(data=_out(updated))
