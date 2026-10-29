"""Host allowlist per affiliate provider."""

import pytest

from app.core.affiliate_hosts import PROVIDER_HOSTS, destination_allowed, host_matches


def allowed(
    provider: str, host: str, website: str | None = None, sample: bool = False
) -> bool:
    return destination_allowed(
        provider, host, merchant_website=website, allow_sample=sample
    )


def test_host_matches_the_entry_and_its_subdomains_only() -> None:
    entries = frozenset({"awin1.com"})

    assert host_matches("awin1.com", entries)
    assert host_matches("www.awin1.com", entries)
    assert not host_matches("awin1.com.evil.example", entries)
    assert not host_matches("notawin1.com", entries)
    assert not host_matches("evil.example", entries)


@pytest.mark.parametrize("provider", sorted(PROVIDER_HOSTS))
def test_each_registered_provider_allows_its_own_hosts_and_nobody_elses(
    provider: str,
) -> None:
    own = min(PROVIDER_HOSTS[provider])
    other = next(
        min(hosts) for name, hosts in PROVIDER_HOSTS.items() if name != provider
    )

    assert allowed(provider, own)
    assert allowed(provider, f"www.{own}")
    assert not allowed(provider, other)
    assert not allowed(provider, "evil.example")


def test_an_unknown_provider_is_never_followed() -> None:
    assert not allowed("mystery", "awin1.com")
    assert not allowed("", "awin1.com")


def test_a_direct_link_must_stay_on_the_merchant_website() -> None:
    site = "https://www.acme.example/shop"

    assert allowed("direct", "acme.example", site)
    assert allowed("direct", "www.acme.example", site)
    assert allowed("direct", "deals.acme.example", site)
    assert not allowed("direct", "acme.example.evil.example", site)
    assert not allowed("direct", "evil.example", site)


@pytest.mark.parametrize("website", [None, "", "http://acme.example", "javascript:1"])
def test_a_direct_link_needs_a_valid_https_merchant_website(
    website: str | None,
) -> None:
    assert not allowed("direct", "acme.example", website)


def test_the_sample_provider_works_only_when_samples_are_allowed() -> None:
    assert allowed("sample", "example.com", sample=True)
    assert not allowed("sample", "example.com", sample=False)
    assert not allowed("sample", "evil.example", sample=True)
