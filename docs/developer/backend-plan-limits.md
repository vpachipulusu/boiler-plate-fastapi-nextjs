# Plan limits on create

The numbers live in `fastapi_backend/app/core/plans.py` (`PLANS`; `None` is unlimited). A limit is enforced where the
resource is created, in the same transaction as the insert, and refused with **409** and a message that names the plan and
says to upgrade. Messages are built in `app/services/plan_limits.py`.

| Limit | Scope | Enforced in | Status |
|---|---|---|---|
| `max_members` | organisation, every membership counts (owner included) | `require_member_capacity` in `plan_limits.py` | helper only, see below |

The plan in force is the Stripe tier or a higher, unexpired admin grant (`effective_plan_key`), read from the platform
database when a create runs. Only creates are limited: reads, edits and deletes work at the limit, and deleting frees a
slot. A downgrade below the current count blocks new items but never removes existing ones.

## Members

The template writes one membership, the owner row created with the organisation (a count of 0 against a minimum limit of
1), so nothing is enforced yet. An invitation flow must, in the transaction that inserts the membership and under the
organisation row lock (`SELECT ... FOR UPDATE` on `organizations`), count memberships and call
`require_member_capacity(count, organization.effective_plan)`, then map `MemberLimitReached` to 409 with `str(error)`.

Response shape: `409 {"error": "The Free plan allows 1 team member. Upgrade your plan to add more."}` (limits of 1 are
singular).

## Adding a limit

1. Add a field to `Plan` and a value per plan in `PLANS`.
2. Add a `*_limit_message` and `require_*_capacity` pair in `plan_limits.py`.
3. Call the helper in the create path, under a lock that serialises concurrent creates (a row lock on the parent, or
   `pg_advisory_xact_lock` when there is no parent row).
4. Expose the field in `PlanData` (`app/api/v1/org_billing.py`), regenerate `openapi.json` and the frontend client.

Tests: `tests/core/test_plans.py`, `tests/services/test_plan_limits.py`.
