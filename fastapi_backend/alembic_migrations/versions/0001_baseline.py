"""Platform baseline

The template's one migration: every platform table as `app/models/platform` defines it
(users, settings, login history, notifications, admins, audit log, organisations,
memberships, invitations, SEO, redirects, app settings, feature flags, email templates
and the Stripe Billing event log). Later schema changes get their own revision; this
one is never edited once a database has run it.

Revision ID: 0001
Revises:
Create Date: 2026-10-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column[sa.DateTime]]:
    return [
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


def _created_at() -> sa.Column[sa.DateTime]:
    return sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def _role_enum() -> sa.Enum:
    return sa.Enum(
        "OWNER", "ADMIN", "STAFF", name="membershiprole", native_enum=False, length=16
    )


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_app_settings")),
        sa.UniqueConstraint("key", name=op.f("uq_app_settings_key")),
    )
    op.create_index(
        op.f("ix_app_settings_category"), "app_settings", ["category"], unique=False
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.Column("organization_id", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("resource", sa.Text(), nullable=False),
        sa.Column("resource_id", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index(
        "ix_audit_logs_action_created_at", "audit_logs", ["action", "created_at"]
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index(
        "ix_audit_logs_organization_id_created_at",
        "audit_logs",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_audit_logs_resource_resource_id", "audit_logs", ["resource", "resource_id"]
    )
    op.create_index(
        "ix_audit_logs_user_id_created_at", "audit_logs", ["user_id", "created_at"]
    )

    op.create_table(
        "email_templates",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("text_body", sa.Text(), nullable=True),
        sa.Column("variables", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_templates")),
        sa.UniqueConstraint("name", name=op.f("uq_email_templates_name")),
    )

    op.create_table(
        "feature_flags",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "rollout_percentage",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_feature_flags")),
        sa.UniqueConstraint("name", name=op.f("uq_feature_flags_name")),
    )
    op.create_index(
        "ix_feature_flags_name_enabled", "feature_flags", ["name", "enabled"]
    )

    op.create_table(
        "organizations",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("stripe_customer_id", sa.Text(), nullable=True),
        sa.Column("stripe_subscription_id", sa.Text(), nullable=True),
        sa.Column("stripe_price_id", sa.Text(), nullable=True),
        sa.Column(
            "stripe_current_period_end", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "stripe_subscription_event_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "stripe_cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "subscription_tier", sa.Text(), server_default="free", nullable=False
        ),
        sa.Column(
            "subscription_status", sa.Text(), server_default="inactive", nullable=False
        ),
        sa.Column("granted_plan", sa.Text(), nullable=True),
        sa.Column("granted_until", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "granted_plan IN ('pro', 'enterprise')",
            name=op.f("ck_organizations_granted_plan_valid"),
        ),
        sa.CheckConstraint(
            "(granted_plan IS NULL) = (granted_until IS NULL)",
            name=op.f("ck_organizations_grant_complete"),
        ),
        sa.CheckConstraint(
            "slug = lower(slug)", name=op.f("ck_organizations_slug_lowercase")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
        sa.UniqueConstraint("slug", name=op.f("uq_organizations_slug")),
        sa.UniqueConstraint(
            "stripe_customer_id", name=op.f("uq_organizations_stripe_customer_id")
        ),
        sa.UniqueConstraint(
            "stripe_subscription_id",
            name=op.f("uq_organizations_stripe_subscription_id"),
        ),
    )

    op.create_table(
        "seo_meta",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("page", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("og_title", sa.Text(), nullable=True),
        sa.Column("og_description", sa.Text(), nullable=True),
        sa.Column("og_image", sa.Text(), nullable=True),
        sa.Column(
            "twitter_card",
            sa.Text(),
            server_default="summary_large_image",
            nullable=True,
        ),
        sa.Column("canonical", sa.Text(), nullable=True),
        sa.Column(
            "noindex", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "nofollow", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_seo_meta")),
        sa.UniqueConstraint("page", name=op.f("uq_seo_meta_page")),
    )

    op.create_table(
        "stripe_events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("stripe_event_id", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("stripe_created_at", sa.DateTime(timezone=True), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stripe_events")),
        sa.UniqueConstraint(
            "stripe_event_id", name=op.f("uq_stripe_events_stripe_event_id")
        ),
    )

    op.create_table(
        "url_redirects",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("from_path", sa.Text(), nullable=False),
        sa.Column("to_path", sa.Text(), nullable=False),
        sa.Column(
            "status_code", sa.Integer(), server_default=sa.text("301"), nullable=False
        ),
        sa.Column(
            "enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_url_redirects")),
        sa.UniqueConstraint("from_path", name=op.f("uq_url_redirects_from_path")),
    )
    op.create_index(
        "ix_url_redirects_from_path_enabled", "url_redirects", ["from_path", "enabled"]
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("firebase_uid", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "email_verified",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("phone_number", sa.Text(), nullable=True),
        sa.Column(
            "two_factor_enabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("two_factor_secret", sa.Text(), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("firebase_uid", name=op.f("uq_users_firebase_uid")),
    )

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), server_default="admin", nullable=False),
        sa.Column(
            "permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_admin_users_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_users")),
        sa.UniqueConstraint("user_id", name=op.f("uq_admin_users_user_id")),
    )
    op.create_index("ix_admin_users_user_id_role", "admin_users", ["user_id", "role"])

    op.create_table(
        "invitations",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", _role_enum(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ACCEPTED",
                "REVOKED",
                "EXPIRED",
                name="invitationstatus",
                native_enum=False,
                length=16,
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("invited_by_user_id", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "role IN ('OWNER', 'ADMIN', 'STAFF')",
            name=op.f("ck_invitations_role_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')",
            name=op.f("ck_invitations_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"],
            ["users.id"],
            name=op.f("fk_invitations_invited_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_invitations_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitations")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_invitations_token_hash")),
    )
    op.create_index(
        "ix_invitations_organization_id_email",
        "invitations",
        ["organization_id", "email"],
    )

    op.create_table(
        "login_history",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column(
            "login_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "successful", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_login_history_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_history")),
    )
    op.create_index(
        "ix_login_history_user_id_login_at", "login_history", ["user_id", "login_at"]
    )

    op.create_table(
        "memberships",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("role", _role_enum(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "role IN ('OWNER', 'ADMIN', 'STAFF')",
            name=op.f("ck_memberships_role_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_memberships_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_memberships_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_memberships")),
        sa.UniqueConstraint(
            "organization_id", "user_id", name="uq_memberships_organization_id_user_id"
        ),
    )
    op.create_index(op.f("ix_memberships_user_id"), "memberships", ["user_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "read", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("link", sa.Text(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_notifications_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_notifications_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index(
        "ix_notifications_organization_id",
        "notifications",
        ["organization_id"],
        postgresql_where=sa.text("organization_id IS NOT NULL"),
    )
    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_notifications_user_id_organization_id",
        "notifications",
        ["user_id", "organization_id"],
    )
    op.create_index(
        "ix_notifications_user_id_read", "notifications", ["user_id", "read"]
    )

    op.create_table(
        "user_settings",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("theme", sa.Text(), server_default="system", nullable=False),
        sa.Column(
            "email_notifications",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("language", sa.Text(), server_default="en", nullable=False),
        sa.Column("timezone", sa.Text(), server_default="UTC", nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_settings_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_settings")),
        sa.UniqueConstraint("user_id", name=op.f("uq_user_settings_user_id")),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
    op.drop_table("notifications")
    op.drop_table("memberships")
    op.drop_table("login_history")
    op.drop_table("invitations")
    op.drop_table("admin_users")
    op.drop_table("users")
    op.drop_table("url_redirects")
    op.drop_table("stripe_events")
    op.drop_table("seo_meta")
    op.drop_table("organizations")
    op.drop_table("feature_flags")
    op.drop_table("email_templates")
    op.drop_table("audit_logs")
    op.drop_table("app_settings")
