"""Delete old outbound click events.

    uv run python -m commands.prune_click_events            # keep 395 days (13 months)
    uv run python -m commands.prune_click_events --days 90

Deletes every ``click_events`` row whose ``occurred_at`` is older than ``--days`` days and prints how many
went. ``occurred_at`` is already truncated to the minute, so the cutoff is exact to the minute. The
retention period and the reasoning are in ``docs/developer/freejoy-affiliate.md``; the privacy page states
the same period, so change both together.

Run it on a schedule (for example monthly). It uses ``DATABASE_URL`` and is safe to repeat.
"""

import argparse
import asyncio
import sys
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.platform.click_event import ClickEvent

DEFAULT_RETENTION_DAYS = 395
MIN_RETENTION_DAYS = 1


async def prune_click_events(
    session: AsyncSession, *, days: int, now: datetime | None = None
) -> int:
    """Delete rows older than ``days`` days inside the caller's transaction; return the count."""
    cutoff = (now or datetime.now(UTC)) - timedelta(days=days)
    result = await session.execute(
        delete(ClickEvent).where(ClickEvent.occurred_at < cutoff)
    )
    return int(cast("CursorResult[Any]", result).rowcount)


async def _run(
    maker: async_sessionmaker[AsyncSession],
    days: int,
    engine: AsyncEngine | None = None,
) -> int:
    try:
        async with maker() as session, session.begin():
            return await prune_click_events(session, days=days)
    finally:
        if engine is not None:
            await engine.dispose()


def _parse(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="prune-click-events", description=__doc__)
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_RETENTION_DAYS,
        help=f"keep this many days (default {DEFAULT_RETENTION_DAYS})",
    )
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    maker: async_sessionmaker[AsyncSession] | None = None,
) -> int:
    """Entry point. ``maker`` exists for tests; the command line passes none."""
    args = _parse(sys.argv[1:] if argv is None else argv)
    if args.days < MIN_RETENTION_DAYS:
        print(f"prune-click-events: --days must be at least {MIN_RETENTION_DAYS}.")
        return 2
    try:
        engine: AsyncEngine | None = None
        if maker is None:
            from app.core.database import async_session_maker, engine

            maker = async_session_maker
        deleted = asyncio.run(_run(maker, args.days, engine))
    except Exception as error:  # noqa: BLE001  (report the type only, never the message)
        print(
            f"prune-click-events: failed ({type(error).__name__}). "
            "Check DATABASE_URL. Nothing was deleted."
        )
        return 1
    print(
        f"prune-click-events: deleted {deleted} click events older than {args.days} days."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
