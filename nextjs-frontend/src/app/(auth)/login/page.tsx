import Link from 'next/link';
import { LoginPanel } from '@/components/auth/login-panel';
import { resolveSafeRedirect } from '@/lib/auth/safe-redirect';
import { AUTH_LINK_CLASS, AuthHeading } from '../_components/auth-shared';

export const metadata = {
  title: 'Login',
  description: 'Login to your account',
};

/**
 * `src/proxy.ts` sends a signed-out visitor from a protected page to `/login?redirect=<path>`. The value is checked
 * here (a path on this site, or `/dashboard`) and handed to the panel, so it is the same for every way of signing in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = resolveSafeRedirect(redirect);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <AuthHeading>Welcome back</AuthHeading>
        <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
      </header>
      <LoginPanel redirectTo={redirectTo} />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className={AUTH_LINK_CLASS}>
          Sign up
        </Link>
      </p>
    </section>
  );
}
