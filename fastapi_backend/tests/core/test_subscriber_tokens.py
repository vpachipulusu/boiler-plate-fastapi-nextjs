from datetime import UTC, datetime, timedelta

import pytest

from app.core.subscriber_tokens import (
    MAX_TOKEN_LENGTH,
    SubscriberTokens,
    TokenPurpose,
    token_digest,
)

NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
TOKENS = SubscriberTokens(b"a-secret-that-is-long-enough-for-tests-0123")
OTHER = SubscriberTokens(b"a-different-secret-that-is-long-enough-0123")


def test_a_token_verifies_to_its_subject_before_it_expires() -> None:
    token = TOKENS.issue(TokenPurpose.CONFIRM, "sub_1", NOW + timedelta(hours=1))

    assert TOKENS.verify(token, TokenPurpose.CONFIRM, NOW) == "sub_1"


def test_a_token_expires_at_its_expiry_time() -> None:
    expires = NOW + timedelta(hours=1)
    token = TOKENS.issue(TokenPurpose.CONFIRM, "sub_1", expires)

    assert TOKENS.verify(token, TokenPurpose.CONFIRM, expires) is None
    assert (
        TOKENS.verify(token, TokenPurpose.CONFIRM, expires - timedelta(seconds=1))
        == "sub_1"
    )


def test_a_token_without_expiry_never_expires() -> None:
    token = TOKENS.issue(TokenPurpose.UNSUBSCRIBE, "sub_1", None)

    assert (
        TOKENS.verify(token, TokenPurpose.UNSUBSCRIBE, NOW + timedelta(days=9999))
        == "sub_1"
    )


def test_a_token_is_only_good_for_its_own_purpose() -> None:
    token = TOKENS.issue(TokenPurpose.UNSUBSCRIBE, "sub_1", None)

    assert TOKENS.verify(token, TokenPurpose.CONFIRM, NOW) is None


def test_a_token_signed_with_another_secret_is_rejected() -> None:
    token = OTHER.issue(TokenPurpose.UNSUBSCRIBE, "sub_1", None)

    assert TOKENS.verify(token, TokenPurpose.UNSUBSCRIBE, NOW) is None


def test_two_tokens_for_the_same_subject_differ() -> None:
    first = TOKENS.issue(TokenPurpose.CONFIRM, "sub_1", NOW + timedelta(hours=1))
    second = TOKENS.issue(TokenPurpose.CONFIRM, "sub_1", NOW + timedelta(hours=1))

    assert first != second


@pytest.mark.parametrize(
    "token",
    [
        "",
        "x",
        ".",
        "a.b",
        "!!!.???",
        "bm90LWEtdG9rZW4.bm90LWEtc2ln",
        "a" * (MAX_TOKEN_LENGTH + 1),
    ],
)
def test_malformed_tokens_are_rejected_without_raising(token: str) -> None:
    assert TOKENS.verify(token, TokenPurpose.CONFIRM, NOW) is None


def test_a_signed_payload_of_the_wrong_shape_is_rejected() -> None:
    import base64
    import hashlib
    import hmac

    raw = b"confirm|only-three|parts"
    signature = hmac.new(TOKENS.secret, raw, hashlib.sha256).digest()

    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    assert (
        TOKENS.verify(f"{b64(raw)}.{b64(signature)}", TokenPurpose.CONFIRM, NOW) is None
    )


def test_token_digest_is_stable_and_hides_the_token() -> None:
    digest = token_digest("abc.def")

    assert digest == token_digest("abc.def")
    assert "abc" not in digest
    assert len(digest) == 64
