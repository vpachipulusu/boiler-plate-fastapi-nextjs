"""Signed tokens for the alerts opt-in emails (confirm and unsubscribe).

A token is ``<payload>.<signature>``, both base64url: the payload is ``purpose|subject|expiry|nonce`` and the
signature is HMAC-SHA256 of the payload under a server secret. Nothing about the address is in the token.
Verification is constant time and answers ``None`` for every failure (bad shape, bad signature, wrong
purpose, expired), so a caller cannot tell the cases apart. Confirm tokens are also single use: the database
keeps a hash of the latest one (see ``app.services.subscribers``).
"""

import base64
import binascii
import enum
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

CONFIRM_TOKEN_TTL = timedelta(hours=24)
# An unsubscribe link must keep working for as long as the email exists.
NO_EXPIRY = 0
MAX_TOKEN_LENGTH = 512
_SEPARATOR = "|"


class TokenPurpose(enum.StrEnum):
    CONFIRM = "confirm"
    UNSUBSCRIBE = "unsubscribe"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def token_digest(token: str) -> str:
    """What the database stores instead of a confirm token."""
    return hashlib.sha256(token.encode("ascii", "ignore")).hexdigest()


@dataclass(frozen=True)
class SubscriberTokens:
    """Issues and verifies tokens under one secret."""

    secret: bytes

    def _sign(self, payload: bytes) -> bytes:
        return hmac.new(self.secret, payload, hashlib.sha256).digest()

    def issue(
        self, purpose: TokenPurpose, subject_id: str, expires_at: datetime | None
    ) -> str:
        expiry = NO_EXPIRY if expires_at is None else int(expires_at.timestamp())
        nonce = secrets.token_hex(8)
        payload = _SEPARATOR.join((purpose.value, subject_id, str(expiry), nonce))
        raw = payload.encode("utf-8")
        return f"{_b64(raw)}.{_b64(self._sign(raw))}"

    def verify(self, token: str, purpose: TokenPurpose, now: datetime) -> str | None:
        """The subject id when the token is genuine, for this purpose and unexpired; else None."""
        if not 0 < len(token) <= MAX_TOKEN_LENGTH:
            return None
        encoded, _, signature = token.partition(".")
        try:
            raw = _unb64(encoded)
            supplied = _unb64(signature)
        except (binascii.Error, ValueError):
            return None
        if not hmac.compare_digest(supplied, self._sign(raw)):
            return None
        try:
            kind, subject_id, expiry, _nonce = raw.decode("utf-8").split(_SEPARATOR)
            expires = int(expiry)
        except ValueError:
            return None
        if kind != purpose.value or not subject_id:
            return None
        if expires != NO_EXPIRY and now >= datetime.fromtimestamp(expires, UTC):
            return None
        return subject_id
