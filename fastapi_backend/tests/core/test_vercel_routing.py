"""The root vercel.json must route Stripe events to the backend.

The backend service has no public route of its own (ADR-011): a path reaches it only
through a top-level rewrite placed before the frontend catch-all. Without one for
``/webhooks/stripe`` Stripe never reaches the backend and a paid plan stays Free.
"""

import inspect
import json
import re
from pathlib import Path

import pytest

VERCEL_JSON = Path(__file__).resolve().parents[3] / "vercel.json"
pytestmark = pytest.mark.skipif(
    not VERCEL_JSON.exists(), reason="root vercel.json is not in this checkout"
)
BACKEND_SERVICE = "fastapi_backend"
STRIPE_WEBHOOK_PATH = "/webhooks/stripe"


def _rewrites() -> list[dict[str, object]]:
    return json.loads(VERCEL_JSON.read_text(encoding="utf-8"))["rewrites"]


def _destination_service(path: str) -> str | None:
    """The service of the first rewrite whose source matches ``path``."""
    for rule in _rewrites():
        source = str(rule["source"])
        if re.fullmatch(re.escape(source).replace(re.escape("(.*)"), ".*"), path):
            destination = rule["destination"]
            assert isinstance(destination, dict)
            return str(destination["service"])
    return None


def test_everything_else_still_reaches_the_frontend() -> None:
    assert _destination_service("/dashboard") == "nextjs-frontend"
    assert _destination_service("/internal-notes") == "nextjs-frontend"


@pytest.mark.parametrize(
    ("path", "service"),
    [
        (STRIPE_WEBHOOK_PATH, BACKEND_SERVICE),
        ("/webhooks/stripe/", "nextjs-frontend"),
        ("/webhooks/stripe/x", "nextjs-frontend"),
        ("/webhooks/stripe-other", "nextjs-frontend"),
        ("/webhooks", "nextjs-frontend"),
        ("/api/webhooks/stripe", "nextjs-frontend"),
    ],
)
def test_only_the_exact_stripe_path_reaches_the_backend(
    path: str, service: str
) -> None:
    assert _destination_service(path) == service


def test_only_the_intended_public_paths_reach_the_backend() -> None:
    backend_rules = [
        r for r in _rewrites() if r["destination"] == {"service": BACKEND_SERVICE}
    ]
    assert [r["source"] for r in backend_rules] == [STRIPE_WEBHOOK_PATH]


def test_the_stripe_route_matches_the_rewrite_and_checks_the_signature() -> None:
    from app.api.v1.webhooks import router

    assert {route.path for route in router.routes} == {STRIPE_WEBHOOK_PATH}  # type: ignore[attr-defined]
    for route in router.routes:
        assert "_verified_body(" in inspect.getsource(route.endpoint)  # type: ignore[attr-defined]
