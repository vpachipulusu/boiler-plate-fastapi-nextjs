import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { adminErrorMessage, fetchAdminUser, toAdminUserDetail } from '@/lib/api/admin-users';
import { userToProfileFormValues } from '@/lib/admin-users/profile-schema';
import { isAdminUserId } from '@/lib/admin-users/user-id';
import { logger } from '@/lib/logger';
import { InlineError } from '../../../_components/inline-error';
import { requireAdminPage } from '../../../_lib/require-admin-page';
import { UserProfileForm } from '../../user-profile-form';

type Params = Promise<{ id: string }>;

const USERS_HREF = '/admin/users';

export const metadata = { title: 'Edit user' };

export default async function EditAdminUserPage({ params }: { params: Params }) {
  await requireAdminPage();
  const { id } = await params;
  if (!isAdminUserId(id)) notFound();
  const result = await fetchAdminUser(id);

  if (!result.success) {
    if (result.status === 404 || result.status === 422) notFound();
    logger.error('Admin user edit page: read failed', { status: result.status });
    return (
      <InlineError
        message={adminErrorMessage(result)}
        retryHref={`${USERS_HREF}/${encodeURIComponent(id)}/edit`}
      />
    );
  }

  const user = toAdminUserDetail(result.data);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href={`${USERS_HREF}/${encodeURIComponent(user.id)}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to user details
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit user</h1>
          <p className="break-all text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <UserProfileForm userId={user.id} initialValues={userToProfileFormValues(user)} />
    </div>
  );
}
