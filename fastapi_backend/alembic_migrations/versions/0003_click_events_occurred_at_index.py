"""Index click_events by time

The retention job deletes click events older than a cutoff across all offers
(`commands/prune_click_events.py`). The existing index starts with `offer_id`, so
that query would scan the whole table; this index serves it. The downgrade drops
only the index.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-29
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_click_events_occurred_at", "click_events", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_click_events_occurred_at", table_name="click_events")
