import json
import logging

import pytest

from app.core.logging import JsonFormatter, configure_logging


def make_record(message: str, exc_info: object = None) -> logging.LogRecord:
    return logging.LogRecord(
        name="yourapp.test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=exc_info,  # type: ignore[arg-type]
    )


def test_formatter_emits_one_json_object() -> None:
    payload = json.loads(JsonFormatter().format(make_record("hello")))

    assert payload["level"] == "WARNING"
    assert payload["logger"] == "yourapp.test"
    assert payload["message"] == "hello"
    assert "exception" not in payload
    assert "timestamp" in payload


def test_formatter_includes_exception() -> None:
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record = make_record("failed", exc_info=sys.exc_info())

    payload = json.loads(JsonFormatter().format(record))

    assert "ValueError: boom" in payload["exception"]


def test_configure_logging_installs_single_json_handler() -> None:
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers, root.level
    try:
        configure_logging("debug")

        assert len(root.handlers) == 1
        assert isinstance(root.handlers[0].formatter, JsonFormatter)
        assert root.level == logging.DEBUG
    finally:
        root.handlers = saved_handlers
        root.setLevel(saved_level)


def test_configure_logging_rejects_unknown_level() -> None:
    root = logging.getLogger()
    saved_handlers = root.handlers
    try:
        with pytest.raises(ValueError):
            configure_logging("loud")
    finally:
        root.handlers = saved_handlers


def test_formatter_includes_request_id_when_set() -> None:
    from app.core.logging import request_id_var

    token = request_id_var.set("req-123")
    try:
        payload = json.loads(JsonFormatter().format(make_record("hi")))
    finally:
        request_id_var.reset(token)

    assert payload["request_id"] == "req-123"


def test_configure_logging_keeps_http_client_request_lines_out_of_the_logs() -> None:
    # httpx logs "GET https://.../contacts/<email>" at INFO; the Brevo calls put an address in the path.
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers, root.level
    httpx_logger = logging.getLogger("httpx")
    httpcore_logger = logging.getLogger("httpcore")
    saved_httpx, saved_httpcore = httpx_logger.level, httpcore_logger.level
    httpx_logger.setLevel(logging.NOTSET)
    httpcore_logger.setLevel(logging.NOTSET)
    try:
        configure_logging("debug")

        assert not logging.getLogger("httpx").isEnabledFor(logging.INFO)
        assert not logging.getLogger("httpcore").isEnabledFor(logging.INFO)
    finally:
        root.handlers = saved_handlers
        root.setLevel(saved_level)
        httpx_logger.setLevel(saved_httpx)
        httpcore_logger.setLevel(saved_httpcore)
