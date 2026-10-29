import pytest

from app.core.catalogue_urls import InvalidUrl, validate_https_url
from app.core.slugs import InvalidSlug, slugify, validate_catalogue_slug


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://example.com", "https://example.com"),
        ("https://Example.COM/Path?q=1#frag", "https://example.com/Path?q=1#frag"),
        ("HTTPS://shop.example.co.uk/a/b", "https://shop.example.co.uk/a/b"),
        ("https://a.example.com:443/x", "https://a.example.com:443/x"),
        ("https://a.example.com:/x", "https://a.example.com/x"),
        ("https://xn--caf-dma.example/path", "https://xn--caf-dma.example/path"),
    ],
)
def test_accepts_https_urls_and_lowercases_the_host(raw, expected):
    assert validate_https_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "http://example.com",
        "ftp://example.com",
        "//example.com",
        "/relative/path",
        "https:example.com",
        "https:///example.com",
        "https://trusted.example.com@evil.example.com",
        "https://user:pass@example.com",
        "https://evil.example.com\\@trusted.example.com",
        "https://example.com\\evil.example.com",
        "https://example.com:8443/x",
        "https://example.com:abc/x",
        "https://127.0.0.1/x",
        "https://2130706433/",
        "https://0x7f.0.0.1/",
        "https://[::1]/x",
        "https://localhost/x",
        "https://example/x",
        "https://-bad.example.com",
        "https://bad-.example.com",
        "https://exa mple.com",
        "https://example.com/a b",
        " https://example.com",
        "https://example.com ",
        "https://example.com/\n",
        "https://example.com/\t",
        "https://example.com/\x00",
        "https://example.com/\u200b",
        "https://example.com/" + chr(0x2028),
        "https://exämple.com/",
        "https://example.com/%0d%0aSet-Cookie:x=1",
        "https://example.com/%00",
        "https://example.com/%7F",
        "https://example..com",
        "https://" + "a" * 64 + ".example.com",
        "https://example.com/" + "a" * 2048,
    ],
)
def test_rejects_unsafe_or_malformed_urls(raw):
    with pytest.raises(InvalidUrl):
        validate_https_url(raw)


def test_rejects_non_strings():
    with pytest.raises(InvalidUrl):
        validate_https_url(None)
    with pytest.raises(InvalidUrl):
        validate_https_url(42)


@pytest.mark.parametrize(
    ("text", "slug"),
    [
        ("Free Sample Box", "free-sample-box"),
        ("  Café -- Crème & Co!  ", "cafe-creme-co"),
        ("100% Free (UK only)", "100-free-uk-only"),
        ("a" * 120, "a" * 80),
        (("word " * 30).strip(), "word-" * 15 + "word"),
    ],
)
def test_slugify_folds_accents_and_collapses_separators(text, slug):
    result = slugify(text)

    assert result == slug[: len(result)]
    assert len(result) <= 80 and not result.endswith("-")


def test_slugify_cuts_on_a_word_edge():
    assert slugify("alpha " + "b" * 74 + " tail") == "alpha-" + "b" * 74


@pytest.mark.parametrize("text", ["", "!!!", "日本語", "-"])
def test_slugify_refuses_text_with_nothing_usable(text):
    with pytest.raises(InvalidSlug):
        slugify(text)


@pytest.mark.parametrize("slug", ["ab", "free-sample", "a1-b2-c3", "x" * 80])
def test_valid_catalogue_slugs_pass_unchanged(slug):
    assert validate_catalogue_slug(slug) == slug


@pytest.mark.parametrize(
    "slug", ["a", "Upper", "two--hyphens", "-lead", "trail-", "sp ace", "é-é", "x" * 81]
)
def test_invalid_catalogue_slugs_are_refused(slug):
    with pytest.raises(InvalidSlug):
        validate_catalogue_slug(slug)
