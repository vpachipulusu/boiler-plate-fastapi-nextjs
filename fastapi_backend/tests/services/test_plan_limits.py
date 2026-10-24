"""Plan limit errors, messages and the member check. No database."""

import pytest

from app.core.plans import PLANS, PlanKey
from app.services.plan_limits import (
    MemberLimitReached,
    PlanLimitReached,
    member_limit_message,
    plan_for,
    require_member_capacity,
)


def test_unknown_tier_counts_as_free() -> None:
    assert plan_for("platinum") is PLANS[PlanKey.FREE]


def test_members_below_the_limit_pass() -> None:
    require_member_capacity(0, "free")
    require_member_capacity(4, "pro")


def test_members_at_the_limit_are_refused_with_an_upgrade_message() -> None:
    with pytest.raises(MemberLimitReached) as caught:
        require_member_capacity(1, "free")

    assert isinstance(caught.value, PlanLimitReached)
    assert (
        str(caught.value)
        == "The Free plan allows 1 team member. Upgrade your plan to add more."
    )


def test_pro_limit_is_five_and_enterprise_is_unlimited() -> None:
    with pytest.raises(MemberLimitReached):
        require_member_capacity(5, "pro")
    require_member_capacity(10_000, "enterprise")


def test_unknown_tier_gets_the_free_member_limit() -> None:
    with pytest.raises(MemberLimitReached):
        require_member_capacity(1, "platinum")


def test_member_message_names_the_plan_and_pluralises() -> None:
    assert member_limit_message(PLANS[PlanKey.PRO]) == (
        "The Pro plan allows 5 team members. Upgrade your plan to add more."
    )
