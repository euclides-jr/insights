'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/auth/sign-out-button';

type AcceptInvitationCardProps = {
  token: string;
  invitationEmail: string;
  invitationRole: 'VIEWER' | 'EDITOR' | 'ADMIN';
  currentEmail: string;
};

export function AcceptInvitationCard({
  token,
  invitationEmail,
  invitationRole,
  currentEmail,
}: AcceptInvitationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const emailMatches =
    invitationEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase();

  function handleAccept() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Failed to accept invitation');
        }

        setAccepted(true);
        router.refresh();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to accept invitation',
        );
      }
    });
  }

  if (accepted) {
    return (
      <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
          Workspace Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
          Invitation accepted
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
          You now have {invitationRole.toLowerCase()} access as{' '}
          <span className="font-medium text-[#0D0D0D]">{invitationEmail}</span>.
        </p>
        <Button
          type="button"
          className="mt-6 h-11 w-full bg-[#E42313] text-white hover:bg-[#C51E11]"
          onClick={() => router.push('/')}
        >
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (!emailMatches) {
    return (
      <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
          Workspace Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
          Wrong account
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
          This invitation is for{' '}
          <span className="font-medium text-[#0D0D0D]">{invitationEmail}</span>,
          but you are signed in as{' '}
          <span className="font-medium text-[#0D0D0D]">{currentEmail}</span>.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
        Workspace Access
      </p>
      <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
        Accept invitation
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
        Join the workspace as{' '}
        <span className="font-medium text-[#0D0D0D]">
          {invitationRole.toLowerCase()}
        </span>{' '}
        using{' '}
        <span className="font-medium text-[#0D0D0D]">{invitationEmail}</span>.
      </p>

      {error ? (
        <p className="mt-4 rounded-sm border border-[#F3C2BE] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A02217]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          className="h-11 flex-1 bg-[#E42313] text-white hover:bg-[#C51E11]"
          onClick={handleAccept}
          disabled={isPending}
        >
          {isPending ? 'Accepting…' : 'Accept Invitation'}
        </Button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-none border border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#FAFAFA]"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
