'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCategoryEnabledAction } from '@/app/actions/admin/category-actions';
import { setMerchantActiveAction } from '@/app/actions/admin/merchant-actions';
import { Button } from '@/components/ui/button';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import { useToast } from '@/hooks/use-toast';

type StateToggleButtonProps = {
  kind: 'category' | 'merchant';
  id: string;
  name: string;
  /** Whether the category is enabled or the merchant is active right now. */
  on: boolean;
};

const WORDS = {
  category: { on: 'Disable', off: 'Enable', done: { on: 'enabled', off: 'disabled' } },
  merchant: { on: 'Deactivate', off: 'Activate', done: { on: 'activated', off: 'deactivated' } },
} as const;

/**
 * Switches a category on or off, or a merchant active or inactive. The result is announced in a toast; the
 * action refreshes the admin page and the public catalogue.
 */
export function StateToggleButton({ kind, id, name, on }: StateToggleButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const words = WORDS[kind];
  const next = !on;

  function toggle(): void {
    startTransition(async () => {
      const result = await settleAction<{ success: boolean; error?: string }>(() =>
        kind === 'category' ? setCategoryEnabledAction(id, next) : setMerchantActiveAction(id, next)
      );
      if (result.success) {
        toast({ title: `${name} ${words.done[next ? 'on' : 'off']}` });
      } else {
        toast({
          variant: 'destructive',
          title: `Could not change ${name}`,
          description: result.error,
        });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11"
      disabled={isPending}
      onClick={toggle}
    >
      {on ? words.on : words.off}
      <span className="sr-only"> {name}</span>
    </Button>
  );
}
