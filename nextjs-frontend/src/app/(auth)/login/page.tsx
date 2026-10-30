import Link from 'next/link';
import { LoginPanel } from '@/components/auth/login-panel';
import { AUTH_LINK_CLASS, AuthHeading } from '../_components/auth-shared';

export const metadata = {
  title: 'Login',
  description: 'Login to your account',
};

export default function LoginPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <AuthHeading>Welcome back</AuthHeading>
        <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
      </header>
      <LoginPanel />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className={AUTH_LINK_CLASS}>
          Sign up
        </Link>
      </p>
    </section>
  );
}
