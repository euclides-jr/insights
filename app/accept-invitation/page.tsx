import Link from 'next/link';
import { getServerSession } from '@/lib/auth/session';
import { getInvitationPreview } from '@/lib/services/membership-service';
import { AcceptInvitationCard } from '@/components/settings/accept-invitation-card';

type AcceptInvitationPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams?.token?.trim();
  const session = await getServerSession();
  const invitation = token ? await getInvitationPreview(token) : null;
  const signInRedirect = token
    ? `/sign-in?redirectTo=${encodeURIComponent(`/accept-invitation?token=${token}`)}`
    : '/sign-in';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(228,35,19,0.18),_transparent_28%),linear-gradient(135deg,_#FFF4EF_0%,_#FAFAFA_38%,_#F2F5F9_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-between gap-12">
        <div className="max-w-xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-[#E42313]">
            Workspace Invite
          </p>
          <h2 className="text-5xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
            Join the analytics workspace.
          </h2>
          <p className="max-w-lg text-base leading-7 text-[#5E5E5E]">
            Invitations are tied to a specific email address and workspace role.
            Sign in with the invited account, then confirm acceptance here.
          </p>
        </div>

        {!token ? (
          <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
              Workspace Access
            </p>
            <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
              Invitation missing
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
              The invitation link is missing its token. Open the full invitation
              URL from the invite email or admin dialog.
            </p>
          </div>
        ) : !invitation ? (
          <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
              Workspace Access
            </p>
            <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
              Invitation not found
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
              This invitation is invalid, expired, or has already been removed.
            </p>
          </div>
        ) : invitation.acceptedAt ? (
          <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
              Workspace Access
            </p>
            <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
              Invitation already accepted
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
              This invite for{' '}
              <span className="font-medium text-[#0D0D0D]">
                {invitation.email}
              </span>{' '}
              has already been used.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-none bg-[#E42313] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C41E0F]"
            >
              Go to dashboard
            </Link>
          </div>
        ) : !session?.user?.email ? (
          <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
              Workspace Access
            </p>
            <h1 className="mt-3 text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
              Sign in to accept
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">
              This invite grants{' '}
              <span className="font-medium text-[#0D0D0D]">
                {invitation.role.toLowerCase()}
              </span>{' '}
              access to{' '}
              <span className="font-medium text-[#0D0D0D]">
                {invitation.email}
              </span>
              .
            </p>
            <Link
              href={signInRedirect}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-none bg-[#E42313] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C41E0F]"
            >
              Sign in to continue
            </Link>
          </div>
        ) : (
          <AcceptInvitationCard
            token={token}
            invitationEmail={invitation.email}
            invitationRole={invitation.role}
            currentEmail={session.user.email}
          />
        )}
      </div>
    </main>
  );
}
