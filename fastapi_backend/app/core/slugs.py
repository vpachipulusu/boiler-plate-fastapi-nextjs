"""Slug rules for organisations.

A slug is a DNS-safe label, so it can become part of a public host name; the rules
are strict. Input is ASCII only (checked before lower-casing, so look-alikes such as the
Kelvin sign cannot fold into ``k``), lower-cased, then must be 3 to 63 characters of
``a-z``, ``0-9`` and single hyphens, with no hyphen at either end. Consecutive hyphens
are refused, which also rules out the ``xn--`` punycode prefix. Names on the reserved
list are refused so an organisation cannot take a platform host.
"""

import re
import unicodedata

SLUG_MIN_LENGTH = 3
SLUG_MAX_LENGTH = 63
_SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

RESERVED_SLUGS: frozenset[str] = frozenset(
    {
        "www",
        "admin",
        "api",
        "app",
        "mail",
        "email",
        "smtp",
        "imap",
        "pop",
        "ftp",
        "ns1",
        "ns2",
        "dns",
        "static",
        "assets",
        "cdn",
        "media",
        "dashboard",
        "console",
        "help",
        "support",
        "docs",
        "blog",
        "status",
        "login",
        "logout",
        "signin",
        "signup",
        "auth",
        "account",
        "billing",
        "checkout",
        "cart",
        "webhooks",
        "internal",
        "root",
        "localhost",
        "staging",
        "dev",
        "test",
        "preview",
        "store",
        "stores",
        "shop",
        "yourapp",
        "postmaster",
        "abuse",
        "hostmaster",
        "webmaster",
        "noreply",
        "security",
        "mx",
        "vpn",
        "git",
        "ssl",
        "web",
        "webmail",
        "autodiscover",
        "sandbox",
        "demo",
        "prod",
        "production",
        "payments",
        "pay",
        "portal",
        "about",
        "pricing",
        "terms",
        "privacy",
        "legal",
        "contact",
        "careers",
        "stripe",
        "firebase",
        "vercel",
    }
)


class InvalidSlug(ValueError):
    """The slug does not match the format rules (422)."""


class ReservedSlug(ValueError):
    """The slug is on the reserved list (422)."""


def normalize_slug(raw: str) -> str:
    """Return the canonical (lower-case) slug or raise ``InvalidSlug``/``ReservedSlug``."""
    if not raw.isascii():
        raise InvalidSlug
    slug = raw.lower()
    if not SLUG_MIN_LENGTH <= len(slug) <= SLUG_MAX_LENGTH:
        raise InvalidSlug
    if _SLUG_PATTERN.fullmatch(slug) is None:
        raise InvalidSlug
    if slug in RESERVED_SLUGS:
        raise ReservedSlug
    return slug


# Catalogue slugs (categories, merchants, offers) are URL path segments, not host labels:
# shorter minimum, longer maximum, no reserved list.
CATALOGUE_SLUG_MIN_LENGTH = 2
CATALOGUE_SLUG_MAX_LENGTH = 80


def slugify(text: str, max_length: int = CATALOGUE_SLUG_MAX_LENGTH) -> str:
    """Derive a catalogue slug from a title or name.

    Accents are folded (``Café`` becomes ``cafe``), every other run of characters outside
    ``a-z0-9`` becomes one hyphen, the result is cut at ``max_length`` on a word edge where
    possible and never starts or ends with a hyphen. Raises ``InvalidSlug`` when nothing usable
    is left (for example a title made only of symbols).
    """
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-")
    if len(slug) > max_length:
        cut = slug[:max_length]
        if slug[max_length] != "-" and "-" in cut:
            cut = cut.rsplit("-", 1)[0]  # do not end on half a word
        slug = cut.strip("-")
    return validate_catalogue_slug(slug)


def validate_catalogue_slug(raw: str) -> str:
    """Return ``raw`` unchanged when it is a valid catalogue slug, else raise ``InvalidSlug``.

    Lower-case ASCII, digits and single hyphens only, so a slug is always safe in a path and
    in a URL without encoding. It is not normalised: an upper-case slug is refused.
    """
    if not raw.isascii():
        raise InvalidSlug
    if not CATALOGUE_SLUG_MIN_LENGTH <= len(raw) <= CATALOGUE_SLUG_MAX_LENGTH:
        raise InvalidSlug
    if _SLUG_PATTERN.fullmatch(raw) is None:
        raise InvalidSlug
    return raw
