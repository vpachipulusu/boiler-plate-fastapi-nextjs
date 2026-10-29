"""Sample catalogue content for ``commands.seed_catalogue``.

Mirrors the Phase 1 fixtures in ``nextjs-frontend/src/lib/catalogue/fixtures.ts``: six categories,
eight merchants and twenty-four offers. Everything here is sample data. Merchant names are
fictional and carry a ``(Sample)`` suffix, offers carry ``SAMPLE_NOTE`` in ``publisher_notes`` and
every affiliate link points at ``https://example.com``. No real brand, logo or destination appears.

One deliberate difference from the fixtures: the ended Bedtime hamper prize draw is ``ARCHIVED``
(the fixtures list it as expired) so the seed holds every offer state: draft, published, expired
and archived.
"""

from dataclasses import dataclass

from app.models.platform import (
    OfferFreshness,
    OfferStatus,
    OfferType,
    PostageKind,
)

SAMPLE_NOTE = "SAMPLE DATA — not a real offer"
SAMPLE_ORIGIN = "https://example.com"
SAMPLE_PROVIDER = "sample"


@dataclass(frozen=True)
class CategorySeed:
    slug: str
    name: str
    short_name: str
    description: str
    intro: str
    tint: str
    sort_order: int


@dataclass(frozen=True)
class MerchantSeed:
    slug: str
    name: str


@dataclass(frozen=True)
class ClaimStep:
    title: str
    detail: str


@dataclass(frozen=True)
class OfferSeed:
    """One sample offer. ``*_days`` are offsets from the day the seed runs."""

    slug: str
    title: str
    summary: str
    description: tuple[str, ...]
    category_slug: str
    merchant_slug: str
    offer_type: OfferType
    image_tint: str
    image_label: str
    image_alt: str
    eligibility: str
    availability: str
    start_days: int
    verified_days: int
    status: OfferStatus = OfferStatus.PUBLISHED
    featured: bool = False
    postage_kind: PostageKind = PostageKind.FREE
    postage_amount_minor: int | None = None
    postage_currency: str | None = None
    requires_card: bool = False
    subscription_terms: str | None = None
    end_days: int | None = None
    freshness: OfferFreshness | None = None


CATEGORIES: tuple[CategorySeed, ...] = (
    CategorySeed(
        slug="beauty",
        name="Beauty",
        short_name="Beauty",
        description="Skincare, lip care and little luxuries to try before you commit to a full size.",
        intro="Trying a product on your own skin is the best way to know if it suits you. Here are sample sizes, vouchers and trials from beauty brands.",
        tint="blush",
        sort_order=1,
    ),
    CategorySeed(
        slug="food-drink",
        name="Food & drink",
        short_name="Food & drink",
        description="Coffee, tea and snacks to taste at home before you stock up.",
        intro="Tasting something new costs very little when a brand lets you sample it first. Browse tasting packs, vouchers and cashback for your kitchen cupboards.",
        tint="mint",
        sort_order=2,
    ),
    CategorySeed(
        slug="home-cleaning",
        name="Home & cleaning",
        short_name="Home",
        description="Cleaning and household offers that make everyday jobs a little easier.",
        intro="From laundry to worktops, small samples show you what works in your own home. Check each offer for how long it runs and what you need to do.",
        tint="butter",
        sort_order=3,
    ),
    CategorySeed(
        slug="baby-kids",
        name="Baby & kids",
        short_name="Baby & kids",
        description="Gentle products and treats to try for the little ones in your life.",
        intro="Small people can have big opinions, so a sample is a sensible first step. Read the eligibility and ingredient details on each offer before you request anything.",
        tint="lavender",
        sort_order=4,
    ),
    CategorySeed(
        slug="pets",
        name="Pets",
        short_name="Pets",
        description="Treats, food and starter offers for dogs, cats and their owners.",
        intro="Pets can be fussy, which makes trying a small amount first a good idea. Find samples, vouchers and cashback for your four-legged family.",
        tint="sky",
        sort_order=5,
    ),
    CategorySeed(
        slug="health-wellness",
        name="Health & wellness",
        short_name="Health",
        description="Teas, supplements and wellbeing extras to try at your own pace.",
        intro="Everyone has a different idea of looking after themselves. These offers are general wellbeing extras and are not medical advice, so check the product details first.",
        tint="sage",
        sort_order=6,
    ),
)

MERCHANTS: tuple[MerchantSeed, ...] = (
    MerchantSeed(slug="soft-kind", name="Soft & Kind (Sample)"),
    MerchantSeed(slug="good-beans", name="Good Beans (Sample)"),
    MerchantSeed(slug="happy-paws", name="Happy Paws (Sample)"),
    MerchantSeed(slug="glow-club", name="Glow Club (Sample)"),
    MerchantSeed(slug="little-bites", name="Little Bites (Sample)"),
    MerchantSeed(slug="fresh-home", name="Fresh Home (Sample)"),
    MerchantSeed(slug="tiny-days", name="Tiny Days (Sample)"),
    MerchantSeed(slug="tea-time", name="Tea Time (Sample)"),
)

# The claim steps are the same for every offer of a type, as in the fixtures.
_STEPS_BY_TYPE: dict[OfferType, tuple[ClaimStep, ...]] = {
    OfferType.FREE_SAMPLE: (
        ClaimStep(
            "Check the details",
            "Read who can claim, any postage to pay and how long the offer runs.",
        ),
        ClaimStep(
            "Visit the provider",
            "Go to the brand and look for the sample request form.",
        ),
        ClaimStep(
            "Follow the instructions",
            "Fill in the form as asked. Samples are limited and the brand decides who receives one.",
        ),
    ),
    OfferType.VOUCHER: (
        ClaimStep(
            "Check the details",
            "Look at the minimum spend, the products it covers and the expiry date.",
        ),
        ClaimStep(
            "Visit the provider", "Go to the brand and add your items to the basket."
        ),
        ClaimStep(
            "Follow the instructions",
            "Enter the code or use the link as described at checkout.",
        ),
    ),
    OfferType.FREE_TRIAL: (
        ClaimStep(
            "Check the details",
            "Note the trial length, the card requirement and how to cancel before you sign up.",
        ),
        ClaimStep(
            "Visit the provider",
            "Go to the brand and start the trial from their sign-up page.",
        ),
        ClaimStep(
            "Follow the instructions",
            "Set a reminder for the day before the trial ends so you can cancel if it is not for you.",
        ),
    ),
    OfferType.CASHBACK: (
        ClaimStep(
            "Check the details",
            "Cashback is paid after you buy, so you pay first and are refunded later.",
        ),
        ClaimStep(
            "Visit the provider",
            "Buy the qualifying product and keep your receipt or order confirmation.",
        ),
        ClaimStep(
            "Follow the instructions",
            "Submit your claim before the deadline and wait for the refund to arrive.",
        ),
    ),
    OfferType.COMPETITION: (
        ClaimStep(
            "Check the details",
            "Read the closing date, the prize and the entry rules before you enter.",
        ),
        ClaimStep("Visit the provider", "Go to the organiser and find the entry page."),
        ClaimStep(
            "Follow the instructions",
            "Enter as instructed. Winners are chosen by the organiser and entering is no guarantee.",
        ),
    ),
}


def steps_for(offer_type: OfferType) -> list[dict[str, str]]:
    """The claim steps as stored in ``offers.steps`` (a JSON list of title/detail)."""
    return [
        {"title": step.title, "detail": step.detail}
        for step in _STEPS_BY_TYPE[offer_type]
    ]
