"""``commands.prune_click_events``: batching, the cutoff and the command-line behaviour."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Self

import pytest
from sqlalchemy.dialects import postgresql

from commands import prune_click_events as command
from commands.prune_click_events import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_RETENTION_DAYS,
    PruneFailed,
    prune_click_events,
)

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


class _Result:
    def __init__(self, rowcount: int) -> None:
        self.rowcount = rowcount


class RecordingSession:
    """Answers each ``execute`` with the next rowcount; fails at ``fail_on`` (1-based) if set."""

    def __init__(self, *rowcounts: int, fail_on: int | None = None) -> None:
        self.statements: list[Any] = []
        self._rowcounts = list(rowcounts)
        self._fail_on = fail_on
        self._calls = 0
        self.commits = 0

    async def execute(self, statement: Any) -> _Result:
        self._calls += 1
        if self._fail_on is not None and self._calls == self._fail_on:
            raise RuntimeError("password=hunter2 host=db.internal")
        self.statements.append(statement)
        return _Result(self._rowcounts.pop(0) if self._rowcounts else 0)

    async def commit(self) -> None:
        self.commits += 1

    def begin(self) -> Self:
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


async def test_it_deletes_in_batches_until_a_short_batch_and_sums_the_total() -> None:
    session = RecordingSession(5, 5, 5, 2)

    deleted = await prune_click_events(session, days=30, batch_size=5, now=NOW)  # type: ignore[arg-type]

    assert deleted == 17
    assert len(session.statements) == 4
    assert session.commits == 4


async def test_it_stops_after_one_short_batch() -> None:
    session = RecordingSession(3)

    deleted = await prune_click_events(session, days=30, batch_size=5, now=NOW)  # type: ignore[arg-type]

    assert deleted == 3 and len(session.statements) == 1 and session.commits == 1


async def test_it_commits_once_and_returns_zero_when_nothing_is_old_enough() -> None:
    session = RecordingSession(0)

    assert await prune_click_events(session, days=30, now=NOW) == 0  # type: ignore[arg-type]
    assert session.commits == 1


async def test_each_batch_selects_ids_below_the_cutoff_with_a_limit() -> None:
    session = RecordingSession(2)

    await prune_click_events(session, days=30, batch_size=7, now=NOW)  # type: ignore[arg-type]

    compiled = session.statements[0].compile(dialect=postgresql.dialect())
    sql = str(compiled)
    assert sql.startswith("DELETE FROM click_events WHERE click_events.id IN (SELECT")
    assert "click_events.occurred_at <" in sql and "LIMIT" in sql
    assert NOW - timedelta(days=30) in compiled.params.values()
    assert 7 in compiled.params.values()


async def test_a_mid_run_failure_reports_what_was_already_deleted() -> None:
    session = RecordingSession(5, 5, fail_on=3)

    with pytest.raises(PruneFailed) as raised:
        await prune_click_events(session, days=30, batch_size=5, now=NOW)  # type: ignore[arg-type]

    assert raised.value.deleted == 10
    assert isinstance(raised.value.__cause__, RuntimeError)
    assert session.commits == 2


def test_the_defaults() -> None:
    assert DEFAULT_RETENTION_DAYS == 395
    assert DEFAULT_BATCH_SIZE == 10_000


def test_main_prints_the_count_and_uses_the_default_period(
    capsys: pytest.CaptureFixture[str],
) -> None:
    session = RecordingSession(3)

    code = command.main([], maker=maker_for(session))

    assert code == 0
    assert "deleted 3 click events older than 395 days" in capsys.readouterr().out


def test_main_accepts_days_and_batch_size(capsys: pytest.CaptureFixture[str]) -> None:
    session = RecordingSession(4, 1)

    code = command.main(["--days", "90", "--batch-size", "4"], maker=maker_for(session))

    assert code == 0
    assert "deleted 5 click events older than 90 days" in capsys.readouterr().out
    assert len(session.statements) == 2


@pytest.mark.parametrize(
    "args",
    [["--days", "0"], ["--days", "-5"], ["--batch-size", "0"], ["--batch-size", "-1"]],
)
def test_main_refuses_values_that_would_delete_everything_or_loop(
    args: list[str], capsys: pytest.CaptureFixture[str]
) -> None:
    session = RecordingSession()

    code = command.main(args, maker=maker_for(session))

    assert code == 2
    assert session.statements == []
    assert "at least 1" in capsys.readouterr().err


def test_main_failure_goes_to_stderr_with_the_count_so_far_and_only_the_error_type(
    capsys: pytest.CaptureFixture[str],
) -> None:
    session = RecordingSession(5, fail_on=2)

    code = command.main(["--batch-size", "5"], maker=maker_for(session))

    captured = capsys.readouterr()
    assert code == 1
    assert captured.out == ""
    assert "RuntimeError" in captured.err
    assert "5 click events were already deleted" in captured.err
    assert "Nothing was deleted" not in captured.err
    assert "hunter2" not in captured.err and "db.internal" not in captured.err


def test_main_failure_before_any_batch_says_zero_were_deleted(
    capsys: pytest.CaptureFixture[str],
) -> None:
    session = RecordingSession(fail_on=1)

    code = command.main([], maker=maker_for(session))

    assert code == 1
    assert "0 click events were already deleted" in capsys.readouterr().err
