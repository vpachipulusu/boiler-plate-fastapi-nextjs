"""The confirmation email: plain text and HTML, with one-click unsubscribe headers (RFC 8058)."""

from html import escape

from app.core.email_provider import EmailMessage

SUBJECT = "Confirm your Freejoy alerts"
CONFIRM_HOURS = 24


def unsubscribe_headers(one_click_url: str) -> dict[str, str]:
    """``List-Unsubscribe`` with an https URL plus the ``-Post`` marker mailbox providers look for."""
    return {
        "List-Unsubscribe": f"<{one_click_url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


def confirmation_message(
    to: str,
    brand: str,
    confirm_url: str,
    unsubscribe_url: str,
    one_click_url: str,
) -> EmailMessage:
    text = (
        f"Hello,\n\n"
        f"Someone, hopefully you, asked for {brand} alerts using this email address.\n\n"
        f"To confirm, open this link within {CONFIRM_HOURS} hours:\n{confirm_url}\n\n"
        f"If this was not you, do nothing: you will not be added to the list. "
        f"To make sure we never email this address, use this link instead:\n"
        f"{unsubscribe_url}\n\n"
        f"{brand}\n"
    )
    html = (
        f"<p>Hello,</p>"
        f"<p>Someone, hopefully you, asked for {escape(brand)} alerts using this email address.</p>"
        f'<p><a href="{escape(confirm_url)}">Confirm my alerts</a> '
        f"(the link works for {CONFIRM_HOURS} hours).</p>"
        f"<p>If this was not you, do nothing: you will not be added to the list. "
        f'To make sure we never email this address, <a href="{escape(unsubscribe_url)}">'
        f"use this link</a>.</p>"
        f"<p>{escape(brand)}</p>"
    )
    return EmailMessage(
        to=to,
        subject=SUBJECT,
        text=text,
        html=html,
        headers=unsubscribe_headers(one_click_url),
    )
