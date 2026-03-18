'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await authClient.signOut();

            if (result.error) {
              setError(result.error.message || 'Unable to sign out.');
              return;
            }

            router.replace('/sign-in');
            router.refresh();
          });
        }}
        className="w-full border border-[#E8E8E8] px-3 py-2 text-left text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? 'Signing out…' : 'Sign out'}
      </button>

      {error ? <p className="text-xs text-[#A02217]">{error}</p> : null}
    </div>
  );
}
