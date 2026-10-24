import dataclasses

import pytest

from app.core.plans import PLANS, Plan, PlanKey, get_plan, is_within_limit


def test_catalogue_has_exactly_free_pro_and_enterprise():
    assert set(PLANS) == {PlanKey.FREE, PlanKey.PRO, PlanKey.ENTERPRISE}
    assert [p.key for p in PLANS.values()] == list(PLANS)


@pytest.mark.parametrize(
    ("key", "members"),
    [(PlanKey.FREE, 1), (PlanKey.PRO, 5), (PlanKey.ENTERPRISE, None)],
)
def test_plan_limits(key, members):
    assert get_plan(key).max_members == members


def test_get_plan_accepts_string_keys():
    assert get_plan("pro") is PLANS[PlanKey.PRO]


@pytest.mark.parametrize("key", ["gold", "", "PRO", None])
def test_get_plan_rejects_unknown_keys(key):
    with pytest.raises(ValueError, match="Unknown subscription plan"):
        get_plan(key)


def test_plans_are_immutable():
    plan = get_plan(PlanKey.FREE)

    with pytest.raises(dataclasses.FrozenInstanceError):
        plan.max_members = 99  # type: ignore[misc]


def test_catalogue_is_read_only():
    with pytest.raises(TypeError):
        PLANS[PlanKey.FREE] = get_plan(PlanKey.PRO)  # type: ignore[index]


def test_limits_increase_from_free_to_pro():
    free, pro = get_plan(PlanKey.FREE), get_plan(PlanKey.PRO)

    assert free.max_members is not None and pro.max_members is not None
    assert free.max_members < pro.max_members


def test_plan_rejects_negative_limits():
    with pytest.raises(ValueError):
        Plan(PlanKey.FREE, "Free", max_members=-1)


def test_is_within_limit():
    assert is_within_limit(0, 1)
    assert not is_within_limit(1, 1)
    assert is_within_limit(10**9, None)
