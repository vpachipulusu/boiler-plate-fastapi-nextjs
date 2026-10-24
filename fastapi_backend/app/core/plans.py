"""Subscription plan catalogue (Stripe Billing module).

Static, typed configuration for the three organisation plans. Billing endpoints
and the Stripe webhook read limits from here; nothing in this module talks to
Stripe or the database.

The limit values are configurable defaults: change them here (one place) when
the product owner decides. ``None`` means unlimited. Add further limits as
fields on ``Plan`` and enforce them where the resource is created
(``app/services/plan_limits.py``).
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType


class PlanKey(StrEnum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass(frozen=True)
class Plan:
    key: PlanKey
    name: str
    max_members: int | None

    def __post_init__(self) -> None:
        if self.max_members is not None and self.max_members < 0:
            raise ValueError(f"Plan {self.key} has a negative limit")


PLANS: Mapping[PlanKey, Plan] = MappingProxyType(
    {
        PlanKey.FREE: Plan(PlanKey.FREE, "Free", max_members=1),
        PlanKey.PRO: Plan(PlanKey.PRO, "Pro", max_members=5),
        PlanKey.ENTERPRISE: Plan(PlanKey.ENTERPRISE, "Enterprise", max_members=None),
    }
)


def get_plan(key: str) -> Plan:
    """Look a plan up by key; raise ValueError for an unknown key."""
    try:
        return PLANS[PlanKey(key)]
    except ValueError:
        raise ValueError(f"Unknown subscription plan: {key!r}") from None


def is_within_limit(current: int, limit: int | None) -> bool:
    """True if one more item can be added under ``limit`` (None is unlimited)."""
    return limit is None or current < limit


_RANK = {PlanKey.FREE: 0, PlanKey.PRO: 1, PlanKey.ENTERPRISE: 2}


def _known(key: str | None) -> PlanKey | None:
    try:
        return PlanKey(key) if key is not None else None
    except ValueError:
        return None


def effective_plan_key(
    tier: str, granted_plan: str | None, granted_until: datetime | None, now: datetime
) -> PlanKey:
    """The plan an organisation gets: the Stripe-backed tier, or an unexpired admin grant if higher.

    A grant never replaces Stripe state (the webhook writes ``tier``); it only lifts
    the plan while it lasts. An unknown tier or grant counts as free.
    """
    stripe_plan = _known(tier) or PlanKey.FREE
    granted = _known(granted_plan)
    if granted is None or granted_until is None or granted_until <= now:
        return stripe_plan
    return granted if _RANK[granted] > _RANK[stripe_plan] else stripe_plan
