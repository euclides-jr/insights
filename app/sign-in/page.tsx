import { SignInForm } from '@/components/auth/sign-in-form';

type SignInPageProps = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(228,35,19,0.18),_transparent_28%),linear-gradient(135deg,_#FFF4EF_0%,_#FAFAFA_38%,_#F2F5F9_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-between gap-12">
        <div className="max-w-xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-[#E42313]">
            Internal Analytics
          </p>
          <h2 className="text-5xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
            The dashboard is now session-protected.
          </h2>
          <p className="max-w-lg text-base leading-7 text-[#5E5E5E]">
            Better Auth handles the session lifecycle, Prisma stores the auth
            records, and Next.js guards the app before protected pages render.
          </p>
        </div>

        <SignInForm redirectTo={resolvedSearchParams?.redirectTo} />
      </div>
    </main>
  );
}
