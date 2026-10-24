"""Subscription plan limits on create: the errors, messages and member check.

``app.core.plans`` holds the numbers; this module turns "one more would pass the limit"
into a curated error whose message tells the user to upgrade. The member helper below
is for the path that adds a membership (an invitation flow, when you build one); the
owner row created with the organisation is the only member the template writes.

A limit of ``None`` is unlimited. Members are counted per organisation (every
membership, the owner included).
"""

from app.core.plans import PLANS, Plan, PlanKey, is_within_limit

UPGRADE_HINT = "Upgrade your plan to add more."


class PlanLimitReached(Exception):
    """The plan allows no more of this resource. The message is safe to show (409)."""


class MemberLimitReached(PlanLimitReached):
    """The organisation's plan allows no more members."""


def plan_for(tier: str) -> Plan:
    """The plan for a tier string; an unknown tier counts as free."""
    try:
        return PLANS[PlanKey(tier)]
    except ValueError:
        return PLANS[PlanKey.FREE]


def _allows(plan: Plan, limit: int | None, singular: str, plural: str) -> str:
    noun = singular if limit == 1 else plural
    return f"The {plan.name} plan allows {limit} {noun}. {UPGRADE_HINT}"


def member_limit_message(plan: Plan) -> str:
    return _allows(plan, plan.max_members, "team member", "team members")


def require_member_capacity(current_members: int, tier: str) -> None:
    """Raise ``MemberLimitReached`` unless one more member fits under the plan.

    ``current_members`` is the organisation's membership count read in the same
    transaction as the insert, under the organisation row lock; the helper cannot
    check that, the caller must.
    """
    plan = plan_for(tier)
    if not is_within_limit(current_members, plan.max_members):
        raise MemberLimitReached(member_limit_message(plan))
