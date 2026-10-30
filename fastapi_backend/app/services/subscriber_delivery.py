"""Sending the confirmation email after the sign-up has been committed (FREEJ-32).

``SubscriberService.subscribe`` commits the row and the hash of the confirm token, then hands back a
``PendingConfirmation``. The route queues ``ConfirmationDelivery.deliver`` to run once the response has been
sent, so no answer waits on the provider and response time no longer tells a new address from a known one.

Failure rules:

* The row is committed with ``confirmation_sent_at`` set, which makes the one-hour resend throttle hold
  while the mail is in flight (a burst of submissions cannot send a burst of mail).
* When the send fails, the claim is withdrawn in a new unit of work: the token hash and
  ``confirmation_sent_at`` are cleared, but only while the stored hash is still this mail's hash, so a newer
  link is never undone. The row then says no mail went out, and the next submission may send at once.
* Errors are logged as operation and HTTP status (provider errors) or the exception class (anything else),
  never an address, a token or a response body.
* If the process is stopped between the commit and the send (a crash, or a host that freezes the function
  once the response is out), nothing withdraws the claim. The row then claims a mail for up to
  ``RESEND_INTERVAL``, after which a resubmission sends again. A durable outbox would close this; see
  ``docs/developer/backend-subscribers.md``.
"""

import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass, field
from typing import Protocol

from app.core.email_provider import EmailMessage, EmailProvider, EmailProviderError
from app.core.sentry import report_exception

logger = logging.getLogger("yourapp.subscribers")


@dataclass(frozen=True)
class PendingConfirmation:
    """A committed sign-up whose email has not been sent yet.

    ``token_hash`` is the hash stored with the row; the message carries the matching token.
    """

    subscriber_id: str
    token_hash: str
    message: EmailMessage = field(repr=False)


class ConfirmationStore(Protocol):
    async def clear_confirmation(self, subscriber_id: str, token_hash: str) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...


UnitOfWork = Callable[
    [], AbstractAsyncContextManager[tuple[ConfirmationStore, Transaction]]
]


class ConfirmationDelivery:
    def __init__(self, provider: EmailProvider, unit_of_work: UnitOfWork) -> None:
        self._provider = provider
        self._unit_of_work = unit_of_work

    async def deliver(self, pending: PendingConfirmation) -> None:
        """Send the email; on any failure withdraw the claim. Never raises (the response is already out)."""
        try:
            await self._provider.send(pending.message)
        except EmailProviderError as exc:
            logger.error("confirmation email failed: %s", exc)
        except Exception as exc:  # noqa: BLE001 - a background step: log the class only, then withdraw
            logger.error("confirmation email failed: %s", type(exc).__name__)
            report_exception(exc)
        else:
            return
        await self._withdraw(pending)

    async def _withdraw(self, pending: PendingConfirmation) -> None:
        try:
            async with self._unit_of_work() as (store, transaction):
                await store.clear_confirmation(
                    pending.subscriber_id, pending.token_hash
                )
                await transaction.commit()
        except Exception as exc:  # noqa: BLE001 - nothing more can be done; the throttle ends on its own
            logger.error(
                "confirmation claim could not be withdrawn: %s", type(exc).__name__
            )
            report_exception(exc)
