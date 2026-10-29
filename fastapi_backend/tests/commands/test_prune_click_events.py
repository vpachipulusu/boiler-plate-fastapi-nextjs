"""``commands.prune_click_events``: the cutoff it deletes at and the command-line behaviour."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Self

import pytest
from sqlalchemy.dialects import postgresql

from commands import prune_click_events as command
from commands.prune_click_events import DEFAULT_RETENTION_DAYS, prune_click_events

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


class _Result:
    def __init__(self, rowcount: int) -> None:
        self.rowcount = rowcount


class RecordingSession:
    def __init__(self, rowcount: int = 0, error: Exception | None = None) -> None:
        self.statements: list[Any] = []
        self._rowcount = rowcount
        self._error = error

    async def execute(self, statement: Any) -> _Result:
        if self._error:
            raise self._error
        self.statements.append(statement)
        return _Result(self._rowcount)

    def begin(self) -> "RecordingSession":
        return self

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_: object) -> None:
        return None


def maker_for(session: RecordingSession) -> Any:
    @asynccontextmanager
    async def maker() -> AsyncIterator[RecordingSession]:
        yield session

    return maker


async def test_it_deletes_rows_older_than_the_cutoff_and_returns_the_count() -> None:
    session = RecordingSession(rowcount=7)

    deleted = await prune_click_events(session, days=30, now=NOW)  # type: ignore[arg-type]

    assert deleted == 7
    compiled = session.statements[0].compile(dialect=postgresql.dialect())
    assert "DELETE FROM click_events WHERE click_events.occurred_at <" in str(compiled)
    assert list(compiled.params.values()) == [NOW - timedelta(days=30)]


def test_the_default_retention_is_thirteen_months() -> None:
    assert DEFAULT_RETENTION_DAYS == 395


def test_main_prints_the_count_and_uses_the_default_period(
    capsys: pytest.CaptureFixture[str],
) -> None:
    session = RecordingSession(rowcount=3)

    code = command.main([], maker=maker_for(session))

    assert code == 0
    assert "deleted 3 click events older than 395 days" in capsys.readouterr().out


def test_main_accepts_days(capsys: pytest.CaptureFixture[str]) -> None:
    code = command.main(["--days", "90"], maker=maker_for(RecordingSession()))

    assert code == 0
    assert "older than 90 days" in capsys.readouterr().out


@pytest.mark.parametrize("days", ["0", "-5"])
def test_main_refuses_a_period_that_would_delete_everything(
    days: str, capsys: pytest.CaptureFixture[str]
) -> None:
    session = RecordingSession()

    code = command.main(["--days", days], maker=maker_for(session))

    assert code == 2
    assert session.statements == []
    assert "at least 1" in capsys.readouterr().out


def test_main_reports_only_the_error_type(capsys: pytest.CaptureFixture[str]) -> None:
    session = RecordingSession(error=RuntimeError("password=hunter2 host=db.internal"))

    code = command.main([], maker=maker_for(session))

    out = capsys.readouterr().out
    assert code == 1
    assert "RuntimeError" in out
    assert "hunter2" not in out and "db.internal" not in out
