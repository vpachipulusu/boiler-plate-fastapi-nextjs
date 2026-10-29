"""Startup validation of the alerts email settings (ADR-012)."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

SECRET = "x" * 32
BREVO = {
    "EMAIL_PROVIDER": "brevo",
    "EMAIL_PROVIDER_API_KEY": "test-key",
    "EMAIL_FROM": "hello@freejoy.test",
    "EMAIL_PROVIDER_LIST_ID": "3",
}


def load(monkeypatch: pytest.MonkeyPatch, **env: str) -> Settings:
    for name in (*BREVO, "SUBSCRIBER_TOKEN_SECRET", "PUBLIC_SITE_URL", "VERCEL_ENV"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return Settings(_env_file=None)  # type: ignore[call-arg]


def test_defaults_send_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = load(monkeypatch)

    assert settings.EMAIL_PROVIDER == ""
    assert settings.PUBLIC_SITE_URL == "http://localhost:3000"


def test_unknown_provider_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError, match="EMAIL_PROVIDER must be"):
        load(monkeypatch, EMAIL_PROVIDER="sendgrid")


@pytest.mark.parametrize("missing", ["EMAIL_PROVIDER_API_KEY", "EMAIL_FROM"])
def test_brevo_needs_its_key_and_sender(
    monkeypatch: pytest.MonkeyPatch, missing: str
) -> None:
    env = {name: value for name, value in BREVO.items() if name != missing}

    with pytest.raises(ValidationError, match="requires EMAIL_PROVIDER_API_KEY"):
        load(monkeypatch, **env)


@pytest.mark.parametrize("list_id", ["", "abc", "-1"])
def test_brevo_needs_a_numeric_list_id(
    monkeypatch: pytest.MonkeyPatch, list_id: str
) -> None:
    with pytest.raises(ValidationError, match="numeric EMAIL_PROVIDER_LIST_ID"):
        load(monkeypatch, **{**BREVO, "EMAIL_PROVIDER_LIST_ID": list_id})


def test_brevo_with_everything_set_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    assert load(monkeypatch, **BREVO).EMAIL_PROVIDER == "brevo"


@pytest.mark.parametrize(
    "url",
    [
        "freejoy.test",
        "ftp://freejoy.test",
        "https://freejoy.test/path",
        "https://h/?q=1",
    ],
)
def test_site_url_must_be_a_bare_origin(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    with pytest.raises(ValidationError, match="PUBLIC_SITE_URL must be an origin"):
        load(monkeypatch, PUBLIC_SITE_URL=url)


def test_token_secret_must_be_long_enough(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError, match="at least 32 characters"):
        load(monkeypatch, SUBSCRIBER_TOKEN_SECRET="short")


def production_env(**extra: str) -> dict[str, str]:
    return {
        "ENVIRONMENT": "production",
        "UPSTASH_REDIS_REST_URL": "https://example.upstash.io",
        "UPSTASH_REDIS_REST_TOKEN": "t",
        "BACKEND_INTERNAL_KEY": "k" * 32,
        "RATE_LIMIT_EMAIL_KEY": "r" * 32,
        "FIREBASE_ADMIN_PROJECT_ID": "p",
        "FIREBASE_ADMIN_CLIENT_EMAIL": "e@example.com",
        "FIREBASE_ADMIN_PRIVATE_KEY": "key",
        **extra,
    }


def test_production_requires_the_token_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError, match="SUBSCRIBER_TOKEN_SECRET must be set"):
        load(monkeypatch, **production_env())


def test_production_refuses_the_fake_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    env = production_env(SUBSCRIBER_TOKEN_SECRET=SECRET, EMAIL_PROVIDER="fake")

    with pytest.raises(ValidationError, match="only allowed in local and test"):
        load(monkeypatch, **env)


def test_production_brevo_needs_an_https_site_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    env = production_env(
        SUBSCRIBER_TOKEN_SECRET=SECRET, PUBLIC_SITE_URL="http://freejoy.test", **BREVO
    )

    with pytest.raises(ValidationError, match="must use https"):
        load(monkeypatch, **env)


def test_production_with_everything_set_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    env = production_env(
        SUBSCRIBER_TOKEN_SECRET=SECRET, PUBLIC_SITE_URL="https://freejoy.test", **BREVO
    )

    assert load(monkeypatch, **env).EMAIL_PROVIDER == "brevo"


def test_blank_secrets_copied_from_the_example_file_count_as_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load(monkeypatch, SUBSCRIBER_TOKEN_SECRET="", EMAIL_PROVIDER_API_KEY="")

    assert settings.SUBSCRIBER_TOKEN_SECRET is None
    assert settings.EMAIL_PROVIDER_API_KEY is None
