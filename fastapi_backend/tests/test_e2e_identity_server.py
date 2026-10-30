"""The e2e identity server: its guards fail closed, and the fake identity accepts only the named sessions."""

import pytest

from app.core import firebase
from tests import e2e_identity_server as server

ADMIN_SESSION = "a" * 24
PLAIN_SESSION = "p" * 24


def environ(**overrides: str) -> dict[str, str]:
    values = {
        "E2E_ADMIN_SESSION_COOKIE": ADMIN_SESSION,
        "E2E_PLAIN_SESSION_COOKIE": PLAIN_SESSION,
    }
    return {**values, **overrides}


def test_reads_both_sessions() -> None:
    sessions = server.read_sessions(environ())
    assert sessions == {ADMIN_SESSION: server.ADMIN, PLAIN_SESSION: server.PLAIN}
    assert server.ADMIN.admin and not server.PLAIN.admin


@pytest.mark.parametrize(
    "overrides",
    [
        {"E2E_ADMIN_SESSION_COOKIE": ""},
        {"E2E_PLAIN_SESSION_COOKIE": "short"},
        {"E2E_PLAIN_SESSION_COOKIE": ADMIN_SESSION},
    ],
)
def test_refuses_missing_short_or_equal_sessions(overrides: dict[str, str]) -> None:
    with pytest.raises(SystemExit) as raised:
        server.read_sessions(environ(**overrides))
    assert raised.value.code == 1


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql+asyncpg://u:p@localhost:5433/freejoy_dev1_test", True),
        ("postgresql+asyncpg://u:p@localhost:5433/freejoy", False),
        ("postgresql+asyncpg://u:p@localhost:5433/", False),
    ],
)
def test_only_a_database_named_test_is_accepted(url: str, expected: bool) -> None:
    assert server.is_test_database(url) is expected


@pytest.mark.asyncio
async def test_fake_identity_accepts_only_the_named_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        firebase.FirebaseIdentityProvider,
        "verify_session_cookie",
        firebase.FirebaseIdentityProvider.verify_session_cookie,
    )
    server.install_identity(server.read_sessions(environ()))
    provider = firebase.FirebaseIdentityProvider()

    admin = await provider.verify_session_cookie(ADMIN_SESSION)
    assert admin["uid"] == server.ADMIN.uid
    assert admin["email_verified"] is True
    assert isinstance(admin["auth_time"], int)
    plain = await provider.verify_session_cookie(PLAIN_SESSION)
    assert plain["uid"] == server.PLAIN.uid
    with pytest.raises(firebase.AuthenticationFailed):
        await provider.verify_session_cookie("not-a-session")
    with pytest.raises(firebase.AuthenticationFailed):
        await provider.verify_session_cookie("")
