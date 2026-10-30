import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry/scrub-token';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // One-use alert tokens travel in page addresses (/alerts/confirm?token=...): never send them.
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  environment: process.env.NODE_ENV,

  // Performance: low sample rate in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
