"""The alerts sign-up rules, over an in-memory store and the recording email provider."""

import logging
from datetime import timedelta

import pytest

from app.core.email_provider import EmailProviderError
from app.core.subscriber_tokens import TokenPurpose, token_digest
from app.models.platform.email_subscriber import AlertFrequency, SubscriberStatus
from app.services.subscribers import (
    PENDING_RETENTION,
    RESEND_INTERVAL,
    InvalidToken,
    ProviderUnavailable,
)
from tests.fakes_subscribers import (
    GatedEmailProvider,
    Harness,
    link_tokens,
    make_request,
)

EMAIL = "sam@example.com"


async def subscribed() -> Harness:
    harness = Harness()
    await harness.subscribe(make_request(EMAIL))
    return harness


async def confirmed() -> Harness:
    harness = await subscribed()
    await harness.service.confirm(harness.last_links()["confirm"])
    return harness


async def test_subscribe_stores_a_pending_row_with_consent_and_sends_one_email() -> (
    None
):
    harness = await subscribed()

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.PENDING
    assert row.categories == ("beauty", "pets")
    assert row.frequency is AlertFrequency.WEEKLY
    assert row.consent_at == harness.clock.now
    assert row.confirmation_sent_at == harness.clock.now
    assert len(harness.provider.sent) == 1
    assert harness.provider.sent[0].to == EMAIL
    assert harness.committer.commits == 1


async def test_confirmation_email_carries_links_and_one_click_headers() -> None:
    harness = await subscribed()

    message = harness.provider.sent[0]
    links = link_tokens(message.text)
    assert set(links) == {"confirm", "unsubscribe"}
    assert message.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    header = message.headers["List-Unsubscribe"]
    assert header.startswith(
        "<https://freejoy.test/alerts/unsubscribe/one-click?token="
    )
    assert header.endswith(">")
    assert "https://freejoy.test/alerts/confirm?token=" in message.html


async def test_only_a_hash_of_the_confirm_token_is_stored() -> None:
    harness = await subscribed()

    (row,) = harness.store.rows.values()
    token = harness.last_links()["confirm"]
    assert row.confirmation_token_hash == token_digest(token)
    assert token not in repr(row)


async def test_resubmitting_within_the_hour_sends_nothing_more() -> None:
    harness = await subscribed()
    harness.clock.advance(RESEND_INTERVAL - timedelta(seconds=1))

    await harness.subscribe(make_request(EMAIL))

    assert len(harness.provider.sent) == 1


async def test_resubmitting_after_the_hour_sends_a_fresh_link_and_voids_the_old_one() -> (
    None
):
    harness = await subscribed()
    old = harness.last_links()["confirm"]
    harness.clock.advance(RESEND_INTERVAL)

    await harness.subscribe(make_request(EMAIL))

    assert len(harness.provider.sent) == 2
    with pytest.raises(InvalidToken):
        await harness.service.confirm(old)
    await harness.service.confirm(harness.last_links()["confirm"])


async def test_resubmission_while_pending_updates_the_choices_but_keeps_the_first_consent() -> (
    None
):
    harness = await subscribed()
    first_consent_at = harness.clock.now
    harness.clock.advance(RESEND_INTERVAL)

    await harness.subscribe(
        make_request(EMAIL, categories=("food-drink",), frequency=AlertFrequency.DAILY)
    )

    (row,) = harness.store.rows.values()
    assert row.categories == ("food-drink",)
    assert row.frequency is AlertFrequency.DAILY
    assert row.consent_at == first_consent_at
    assert row.confirmation_sent_at == harness.clock.now


async def test_a_pending_row_older_than_the_retention_period_gets_a_fresh_consent_record() -> (
    None
):
    harness = await subscribed()
    harness.clock.advance(PENDING_RETENTION)

    await harness.subscribe(make_request(EMAIL))

    (row,) = harness.store.rows.values()
    assert row.consent_at == harness.clock.now
    assert row.confirmation_sent_at == harness.clock.now
    assert len(harness.provider.sent) == 2


async def test_a_pending_row_younger_than_the_retention_period_keeps_its_consent_record() -> (
    None
):
    harness = await subscribed()
    first = harness.clock.now
    harness.clock.advance(timedelta(days=5))

    await harness.subscribe(make_request(EMAIL))

    (row,) = harness.store.rows.values()
    assert row.consent_at == first
    assert len(harness.provider.sent) == 2


async def test_a_pending_row_inside_the_resend_interval_is_left_alone_and_sends_nothing() -> (
    None
):
    harness = await subscribed()
    before = next(iter(harness.store.rows.values()))
    harness.clock.advance(timedelta(minutes=5))

    await harness.subscribe(
        make_request(EMAIL, categories=("pets",), frequency=AlertFrequency.DAILY)
    )

    assert next(iter(harness.store.rows.values())) == before
    assert len(harness.provider.sent) == 1


async def test_the_confirmation_subject_names_the_brand() -> None:
    harness = await subscribed()

    assert harness.provider.sent[0].subject == "Confirm your Freejoy alerts"


async def test_a_confirmed_subscriber_is_not_changed_or_emailed() -> None:
    harness = await confirmed()
    before = next(iter(harness.store.rows.values()))
    harness.clock.advance(timedelta(days=2))

    await harness.subscribe(
        make_request(EMAIL, categories=("pets",), frequency=AlertFrequency.DAILY)
    )

    assert next(iter(harness.store.rows.values())) == before
    assert len(harness.provider.sent) == 1


async def test_subscribe_for_an_unsubscribed_address_sends_nothing() -> None:
    harness = await confirmed()
    await harness.service.unsubscribe(harness.last_links()["unsubscribe"])
    before = next(iter(harness.store.rows.values()))
    harness.clock.advance(timedelta(days=30))

    await harness.subscribe(make_request(EMAIL))

    assert next(iter(harness.store.rows.values())) == before
    assert len(harness.provider.sent) == 1


async def test_subscribe_commits_and_returns_the_mail_without_calling_the_provider() -> (
    None
):
    provider = GatedEmailProvider()
    harness = Harness(provider)

    pending = await harness.service.subscribe(make_request(EMAIL))

    (row,) = harness.store.rows.values()
    assert pending is not None
    assert provider.sent == []
    assert not provider.started.is_set()
    assert harness.committer.commits == 1
    assert harness.committer.rollbacks == 0
    assert row.confirmation_sent_at == harness.clock.now
    assert pending.subscriber_id == row.id
    assert pending.token_hash == row.confirmation_token_hash
    assert pending.message.to == EMAIL


async def test_the_mail_carries_the_token_whose_hash_was_stored() -> None:
    harness = Harness()

    pending = await harness.service.subscribe(make_request(EMAIL))
    assert pending is not None
    await harness.delivery.deliver(pending)

    (row,) = harness.store.rows.values()
    assert row.confirmation_token_hash == token_digest(harness.last_links()["confirm"])
    await harness.service.confirm(harness.last_links()["confirm"])


async def test_paths_that_send_nothing_return_no_pending_mail() -> None:
    harness = await confirmed()
    before = next(iter(harness.store.rows.values()))

    nothing = await harness.service.subscribe(make_request(EMAIL))

    assert nothing is None
    assert next(iter(harness.store.rows.values())) == before


async def test_a_pending_row_inside_the_resend_interval_returns_no_pending_mail() -> (
    None
):
    harness = await subscribed()
    harness.clock.advance(timedelta(minutes=5))

    assert await harness.service.subscribe(make_request(EMAIL)) is None


async def test_a_failed_send_withdraws_the_claim_so_nothing_says_a_mail_went_out() -> (
    None
):
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 500)

    await harness.subscribe(make_request(EMAIL))

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.PENDING
    assert row.confirmation_sent_at is None
    assert row.confirmation_token_hash is None
    assert harness.provider.sent == []
    assert harness.units_opened == 1


async def test_after_a_failed_send_an_immediate_retry_sends_a_working_link() -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 500)
    await harness.subscribe(make_request(EMAIL))
    harness.provider.error = None

    await harness.subscribe(make_request(EMAIL))

    assert len(harness.provider.sent) == 1
    await harness.service.confirm(harness.last_links()["confirm"])


async def test_a_failed_resend_keeps_the_throttle_clear() -> None:
    harness = await subscribed()
    harness.clock.advance(RESEND_INTERVAL)
    harness.provider.error = EmailProviderError("send", 500)
    await harness.subscribe(make_request(EMAIL))
    harness.provider.error = None

    await harness.subscribe(make_request(EMAIL))

    assert len(harness.provider.sent) == 2


async def test_a_successful_send_leaves_the_claim_and_opens_no_second_unit_of_work() -> (
    None
):
    harness = await subscribed()

    (row,) = harness.store.rows.values()
    assert row.confirmation_sent_at == harness.clock.now
    assert row.confirmation_token_hash is not None
    assert harness.units_opened == 0


async def test_a_late_failure_does_not_withdraw_a_newer_token() -> None:
    harness = Harness()
    first = await harness.service.subscribe(make_request(EMAIL))
    harness.clock.advance(RESEND_INTERVAL)
    await harness.subscribe(make_request(EMAIL))
    newer = next(iter(harness.store.rows.values()))
    harness.provider.error = EmailProviderError("send", 503)
    assert first is not None

    await harness.delivery.deliver(first)

    assert next(iter(harness.store.rows.values())) == newer
    assert newer.confirmation_token_hash is not None


async def test_a_provider_failure_is_logged_with_operation_and_status_only(
    caplog: pytest.LogCaptureFixture,
) -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 503)

    with caplog.at_level(logging.ERROR):
        pending = await harness.service.subscribe(make_request(EMAIL))
        assert pending is not None
        await harness.delivery.deliver(pending)

    logged = " ".join(record.getMessage() for record in caplog.records)
    assert "send" in logged and "503" in logged
    token = link_tokens(pending.message.text)["confirm"]
    assert EMAIL not in logged and token not in logged


async def test_an_unexpected_send_error_also_withdraws_the_claim_and_logs_no_message(
    caplog: pytest.LogCaptureFixture,
) -> None:
    harness = Harness()

    async def explode(message: object) -> None:
        raise RuntimeError(f"boom for {EMAIL}")

    harness.provider.send = explode  # type: ignore[method-assign]

    with caplog.at_level(logging.ERROR):
        await harness.subscribe(make_request(EMAIL))

    (row,) = harness.store.rows.values()
    assert row.confirmation_sent_at is None and row.confirmation_token_hash is None
    logged = " ".join(record.getMessage() for record in caplog.records)
    assert "RuntimeError" in logged and EMAIL not in logged


async def test_a_failing_withdrawal_is_logged_and_never_raised(
    caplog: pytest.LogCaptureFixture,
) -> None:
    harness = Harness()
    harness.provider.error = EmailProviderError("send", 500)

    async def broken(subscriber_id: str, token_hash: str) -> None:
        raise ConnectionError(f"database down for {EMAIL}")

    harness.store.clear_confirmation = broken  # type: ignore[method-assign]

    with caplog.at_level(logging.ERROR):
        await harness.subscribe(make_request(EMAIL))

    logged = " ".join(record.getMessage() for record in caplog.records)
    assert "ConnectionError" in logged and EMAIL not in logged


async def test_a_row_deleted_between_insert_and_lookup_is_ignored() -> None:
    harness = Harness()

    async def always_conflict(values: dict[str, object]) -> None:
        return None

    harness.store.insert_pending = always_conflict  # type: ignore[method-assign]

    await harness.subscribe(make_request(EMAIL))

    assert harness.provider.sent == []


async def test_confirm_moves_to_confirmed_and_syncs_the_provider() -> None:
    harness = await subscribed()

    await harness.service.confirm(harness.last_links()["confirm"])

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.CONFIRMED
    assert row.confirmed_at == harness.clock.now
    assert row.confirmation_token_hash is None
    assert row.provider_subscriber_id == "fake-1"
    (contact,) = harness.provider.upserts
    assert (contact.email, contact.categories, contact.frequency) == (
        EMAIL,
        ("beauty", "pets"),
        "WEEKLY",
    )


async def test_a_used_confirm_token_is_rejected() -> None:
    harness = await confirmed()

    with pytest.raises(InvalidToken):
        await harness.service.confirm(
            link_tokens(harness.provider.sent[0].text)["confirm"]
        )

    assert len(harness.provider.upserts) == 1


async def test_an_expired_confirm_token_is_rejected() -> None:
    harness = await subscribed()
    token = harness.last_links()["confirm"]
    harness.clock.advance(timedelta(hours=24, seconds=1))

    with pytest.raises(InvalidToken):
        await harness.service.confirm(token)


async def test_a_tampered_confirm_token_is_rejected() -> None:
    harness = await subscribed()
    token = harness.last_links()["confirm"]
    payload, signature = token.split(".")
    tampered = f"{payload}.{signature[:-2]}AA"

    with pytest.raises(InvalidToken):
        await harness.service.confirm(tampered)


async def test_an_unsubscribe_token_cannot_confirm() -> None:
    harness = await subscribed()

    with pytest.raises(InvalidToken):
        await harness.service.confirm(harness.last_links()["unsubscribe"])


async def test_a_validly_signed_token_that_is_not_the_latest_is_rejected() -> None:
    harness = await subscribed()
    (row,) = harness.store.rows.values()
    forged = harness.tokens.issue(
        TokenPurpose.CONFIRM, row.id, harness.clock.now + timedelta(hours=1)
    )

    with pytest.raises(InvalidToken):
        await harness.service.confirm(forged)


async def test_a_token_for_a_missing_subscriber_is_rejected() -> None:
    harness = Harness()
    token = harness.tokens.issue(
        TokenPurpose.CONFIRM, "gone", harness.clock.now + timedelta(hours=1)
    )

    with pytest.raises(InvalidToken):
        await harness.service.confirm(token)


async def test_a_provider_failure_on_confirm_keeps_the_link_usable() -> None:
    harness = await subscribed()
    token = harness.last_links()["confirm"]
    harness.provider.error = EmailProviderError("upsert", 503)
    with pytest.raises(ProviderUnavailable):
        await harness.service.confirm(token)
    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.PENDING
    harness.provider.error = None

    await harness.service.confirm(token)

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.CONFIRMED


async def test_unsubscribe_marks_the_row_and_removes_the_provider_contact() -> None:
    harness = await confirmed()

    await harness.service.unsubscribe(harness.last_links()["unsubscribe"])

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.UNSUBSCRIBED
    assert row.unsubscribed_at == harness.clock.now
    assert harness.provider.deleted == [("fake-1", EMAIL)]
    assert row.categories == ()
    assert row.provider_subscriber_id is None


async def test_unsubscribing_twice_succeeds_twice_and_keeps_the_first_time() -> None:
    harness = await confirmed()
    token = harness.last_links()["unsubscribe"]
    await harness.service.unsubscribe(token)
    first = next(iter(harness.store.rows.values())).unsubscribed_at
    harness.clock.advance(timedelta(days=3))

    await harness.service.unsubscribe(token)

    assert next(iter(harness.store.rows.values())).unsubscribed_at == first
    assert len(harness.provider.deleted) == 2


async def test_a_pending_subscriber_can_unsubscribe_from_the_confirmation_email() -> (
    None
):
    harness = await subscribed()
    confirm_token = harness.last_links()["confirm"]

    await harness.service.unsubscribe(harness.last_links()["unsubscribe"])

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.UNSUBSCRIBED
    assert row.confirmation_token_hash is None
    with pytest.raises(InvalidToken):
        await harness.service.confirm(confirm_token)


async def test_unsubscribe_token_never_expires() -> None:
    harness = await confirmed()
    token = harness.last_links()["unsubscribe"]
    harness.clock.advance(timedelta(days=900))

    await harness.service.unsubscribe(token)

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.UNSUBSCRIBED


async def test_a_confirm_token_cannot_unsubscribe() -> None:
    harness = await subscribed()

    with pytest.raises(InvalidToken):
        await harness.service.unsubscribe(harness.last_links()["confirm"])


async def test_unsubscribe_after_the_row_was_purged_succeeds_quietly() -> None:
    harness = Harness()
    token = harness.tokens.issue(TokenPurpose.UNSUBSCRIBE, "purged", None)

    await harness.service.unsubscribe(token)

    assert harness.provider.deleted == []


async def test_a_provider_failure_on_unsubscribe_still_unsubscribes_locally() -> None:
    harness = await confirmed()
    token = harness.last_links()["unsubscribe"]
    harness.provider.error = EmailProviderError("remove", 500)

    with pytest.raises(ProviderUnavailable):
        await harness.service.unsubscribe(token)

    (row,) = harness.store.rows.values()
    assert row.status is SubscriberStatus.UNSUBSCRIBED
    harness.provider.error = None
    await harness.service.unsubscribe(token)
    assert harness.provider.deleted == [(None, EMAIL)]


async def test_a_token_older_than_the_stored_send_time_allows_is_rejected() -> None:
    harness = await subscribed()
    token = harness.last_links()["confirm"]
    (row,) = harness.store.rows.values()
    harness.clock.advance(timedelta(hours=23))
    # The row says the link went out 25 hours ago (for example a clock correction), whatever the token says.
    await harness.store.update(
        row.id, {"confirmation_sent_at": harness.clock.now - timedelta(hours=25)}
    )

    with pytest.raises(InvalidToken):
        await harness.service.confirm(token)
