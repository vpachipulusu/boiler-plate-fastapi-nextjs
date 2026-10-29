"""Which hosts an affiliate link may send a visitor to, per provider.

An editor stores ``destination_url`` on an affiliate link. ``catalogue_urls`` already refuses
anything that is not a clean https URL, but a clean URL can still point anywhere. The outbound
redirect therefore also checks the destination host against the provider named on the link, so a
typo, a compromised admin account or a hand-edited row cannot turn ``/go/<id>`` into an open
redirect to an arbitrary site.

A host matches an allowed entry when it is that host or a subdomain of it
(``www.awin1.com`` matches ``awin1.com``; ``awin1.com.evil.example`` does not).

* ``PROVIDER_HOSTS`` is the reviewed registry of affiliate networks. To support a new network,
  add it here in a pull request (see ``docs/developer/freejoy-affiliate.md``).
* ``direct`` links point at the merchant's own site: the host must be the host of the
  merchant's stored website (or a subdomain of it; a leading ``www.`` is ignored). A merchant
  without a website cannot have a ``direct`` link followed.
* ``sample`` is the provider the local seed command uses, with ``example.com`` links. It is
  honoured only in local, test and Vercel preview/development environments.
* An unknown provider is never followed.
"""

from collections.abc import Mapping
from urllib.parse import urlsplit

from app.core.catalogue_urls import InvalidUrl, validate_https_url

DIRECT_PROVIDER = "direct"
SAMPLE_PROVIDER = "sample"
SAMPLE_HOSTS = frozenset({"example.com"})

PROVIDER_HOSTS: Mapping[str, frozenset[str]] = {
    "awin": frozenset({"awin1.com"}),
    "cj": frozenset(
        {"anrdoezrs.net", "dpbolvw.net", "jdoqocy.com", "kqzyfj.com", "tkqlhce.com"}
    ),
    "partnerize": frozenset({"prf.hn"}),
    "rakuten": frozenset({"linksynergy.com"}),
    "tradedoubler": frozenset({"tradedoubler.com"}),
}


def host_matches(host: str, allowed: frozenset[str]) -> bool:
    """True when ``host`` is one of ``allowed`` or a subdomain of one."""
    return any(host == entry or host.endswith(f".{entry}") for entry in allowed)


def _merchant_host(website: str | None) -> str | None:
    if website is None:
        return None
    try:
        host = urlsplit(validate_https_url(website)).hostname
    except InvalidUrl:
        return None
    return host.removeprefix("www.") if host else None


def destination_allowed(
    provider: str,
    host: str,
    *,
    merchant_website: str | None,
    allow_sample: bool,
) -> bool:
    """Whether a link of ``provider`` may send a visitor to ``host`` (already lower-cased)."""
    if provider == DIRECT_PROVIDER:
        merchant = _merchant_host(merchant_website)
        return merchant is not None and host_matches(host, frozenset({merchant}))
    if provider == SAMPLE_PROVIDER:
        return allow_sample and host_matches(host, SAMPLE_HOSTS)
    allowed = PROVIDER_HOSTS.get(provider)
    return allowed is not None and host_matches(host, allowed)
