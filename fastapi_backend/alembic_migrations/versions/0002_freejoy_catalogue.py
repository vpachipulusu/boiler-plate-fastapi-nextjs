"""Freejoy catalogue

Adds the catalogue tables the public site and the admin API read and write:
categories, merchants, offers, affiliate_links, click_events and email_subscribers
(models in `app/models/platform/`). Enums are short text plus a named CHECK, like
the baseline. `0001` is not edited.

The downgrade drops the catalogue tables, including subscriber consent records and
the affiliate click reconciliation record: run it only against a throwaway database
(CI, `*_test`), never against data you need to keep.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-29
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _create_categories() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("short_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("intro", sa.Text(), nullable=False),
        sa.Column("tint", sa.Text(), nullable=False),
        sa.Column(
            "sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
    )


def _create_merchants() -> None:
    op.create_table(
        "merchants",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column(
            "active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_merchants")),
        sa.UniqueConstraint("slug", name=op.f("uq_merchants_slug")),
    )


def _offer_columns() -> list[sa.Column[Any]]:
    return [
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "description",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("category_id", sa.Text(), nullable=False),
        sa.Column("merchant_id", sa.Text(), nullable=False),
        sa.Column(
            "offer_type",
            sa.Enum(
                "FREE_SAMPLE",
                "FREE_TRIAL",
                "CASHBACK",
                "VOUCHER",
                "COMPETITION",
                name="offertype",
                native_enum=False,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "PUBLISHED",
                "EXPIRED",
                "ARCHIVED",
                name="offerstatus",
                native_enum=False,
                length=16,
            ),
            server_default="DRAFT",
            nullable=False,
        ),
        sa.Column(
            "featured", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("image_tint", sa.Text(), nullable=False),
        sa.Column("image_label", sa.Text(), nullable=False),
        sa.Column("image_alt", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column(
            "postage_kind",
            sa.Enum(
                "FREE",
                "COST",
                "CHECK_TERMS",
                name="postagekind",
                native_enum=False,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("postage_amount_minor", sa.Integer(), nullable=True),
        sa.Column("postage_currency", sa.Text(), nullable=True),
        sa.Column(
            "requires_card",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("subscription_terms", sa.Text(), nullable=True),
        sa.Column("eligibility", sa.Text(), nullable=False),
        sa.Column("availability", sa.Text(), nullable=False),
        sa.Column(
            "steps",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "freshness",
            sa.Enum(
                "NEW_TODAY",
                "JUST_ADDED",
                "POPULAR",
                "ENDS_SOON",
                "LIMITED",
                name="offerfreshness",
                native_enum=False,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("publisher_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def _create_offers() -> None:
    op.create_table(
        "offers",
        *_offer_columns(),
        sa.CheckConstraint(
            "(postage_kind = 'COST' AND postage_amount_minor IS NOT NULL"
            " AND postage_amount_minor >= 0 AND postage_currency IS NOT NULL"
            " AND char_length(postage_currency) = 3"
            " AND postage_currency = upper(postage_currency))"
            " OR (postage_kind <> 'COST' AND postage_amount_minor IS NULL"
            " AND postage_currency IS NULL)",
            name=op.f("ck_offers_postage_cost_complete"),
        ),
        sa.CheckConstraint(
            "status <> 'PUBLISHED' OR last_verified_at IS NOT NULL",
            name=op.f("ck_offers_published_is_verified"),
        ),
        sa.CheckConstraint(
            "freshness IN ('NEW_TODAY', 'JUST_ADDED', 'POPULAR', 'ENDS_SOON', 'LIMITED')",
            name=op.f("ck_offers_freshness_valid"),
        ),
        sa.CheckConstraint(
            "offer_type IN ('FREE_SAMPLE', 'FREE_TRIAL', 'CASHBACK', 'VOUCHER', 'COMPETITION')",
            name=op.f("ck_offers_offer_type_valid"),
        ),
        sa.CheckConstraint(
            "postage_kind IN ('FREE', 'COST', 'CHECK_TERMS')",
            name=op.f("ck_offers_postage_kind_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'PUBLISHED', 'EXPIRED', 'ARCHIVED')",
            name=op.f("ck_offers_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_offers_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["merchant_id"],
            ["merchants.id"],
            name=op.f("fk_offers_merchant_id_merchants"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_offers")),
        sa.UniqueConstraint("slug", name=op.f("uq_offers_slug")),
    )
    op.create_index(
        "ix_offers_category_id_status",
        "offers",
        ["category_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_offers_merchant_id"), "offers", ["merchant_id"], unique=False
    )
    op.create_index(
        "ix_offers_status_end_at", "offers", ["status", "end_at"], unique=False
    )


def _create_affiliate_links() -> None:
    op.create_table(
        "affiliate_links",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("offer_id", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("destination_url", sa.Text(), nullable=False),
        sa.Column("tracking_id", sa.Text(), nullable=True),
        sa.Column(
            "active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"],
            ["offers.id"],
            name=op.f("fk_affiliate_links_offer_id_offers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_affiliate_links")),
    )
    op.create_index(
        "ix_affiliate_links_offer_id_active",
        "affiliate_links",
        ["offer_id", "active"],
        unique=False,
    )


def _create_click_events() -> None:
    op.create_table(
        "click_events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("offer_id", sa.Text(), nullable=False),
        sa.Column("affiliate_link_id", sa.Text(), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("date_trunc('minute', now())"),
            nullable=False,
        ),
        sa.Column("referrer_host", sa.Text(), nullable=True),
        sa.Column(
            "user_agent_class",
            sa.Enum(
                "DESKTOP",
                "MOBILE",
                "TABLET",
                "BOT",
                "OTHER",
                name="useragentclass",
                native_enum=False,
                length=16,
            ),
            nullable=True,
        ),
        sa.CheckConstraint(
            "user_agent_class IN ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'OTHER')",
            name=op.f("ck_click_events_user_agent_class_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["affiliate_link_id"],
            ["affiliate_links.id"],
            name=op.f("fk_click_events_affiliate_link_id_affiliate_links"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"],
            ["offers.id"],
            name=op.f("fk_click_events_offer_id_offers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_click_events")),
    )
    op.create_index(
        "ix_click_events_offer_id_occurred_at",
        "click_events",
        ["offer_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_click_events_affiliate_link_id"),
        "click_events",
        ["affiliate_link_id"],
        unique=False,
    )


def _create_email_subscribers() -> None:
    op.create_table(
        "email_subscribers",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "CONFIRMED",
                "UNSUBSCRIBED",
                name="subscriberstatus",
                native_enum=False,
                length=16,
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "categories",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "frequency",
            sa.Enum(
                "DAILY", "WEEKLY", name="alertfrequency", native_enum=False, length=16
            ),
            nullable=False,
        ),
        sa.Column("consent_text", sa.Text(), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_source", sa.Text(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_subscriber_id", sa.Text(), nullable=True),
        sa.Column("confirmation_token_hash", sa.Text(), nullable=True),
        sa.Column("confirmation_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "frequency IN ('DAILY', 'WEEKLY')",
            name=op.f("ck_email_subscribers_frequency_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED')",
            name=op.f("ck_email_subscribers_status_valid"),
        ),
        sa.CheckConstraint(
            "email = lower(email)", name=op.f("ck_email_subscribers_email_lowercase")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_subscribers")),
        sa.UniqueConstraint(
            "confirmation_token_hash",
            name=op.f("uq_email_subscribers_confirmation_token_hash"),
        ),
        sa.UniqueConstraint("email", name=op.f("uq_email_subscribers_email")),
    )


def upgrade() -> None:
    _create_categories()
    _create_merchants()
    _create_offers()
    _create_affiliate_links()
    _create_click_events()
    _create_email_subscribers()


def downgrade() -> None:
    op.drop_index(op.f("ix_click_events_affiliate_link_id"), table_name="click_events")
    op.drop_index("ix_click_events_offer_id_occurred_at", table_name="click_events")
    op.drop_table("click_events")
    op.drop_index("ix_affiliate_links_offer_id_active", table_name="affiliate_links")
    op.drop_table("affiliate_links")
    op.drop_index("ix_offers_status_end_at", table_name="offers")
    op.drop_index(op.f("ix_offers_merchant_id"), table_name="offers")
    op.drop_index("ix_offers_category_id_status", table_name="offers")
    op.drop_table("offers")
    op.drop_table("merchants")
    op.drop_table("email_subscribers")
    op.drop_table("categories")
