from fastapi import APIRouter

from app.api.v1 import (
    admin_analytics,
    admin_audit_logs,
    admin_subscriptions,
    admin_users,
    auth,
    health,
    me,
    me_export,
    notifications,
    org_billing,
    organizations,
    settings,
    totp,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(me_export.router)
api_router.include_router(notifications.router)
api_router.include_router(totp.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_audit_logs.router)
api_router.include_router(admin_analytics.router)
api_router.include_router(organizations.router)
api_router.include_router(settings.router)

# Stripe Billing module (docs/developer/modules.md): remove these three lines with the module.
api_router.include_router(webhooks.router)
api_router.include_router(admin_subscriptions.router)
api_router.include_router(org_billing.router)
