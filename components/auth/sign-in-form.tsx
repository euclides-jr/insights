'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import { authClient } from '@/lib/auth-client';
import { getSafeRedirectPath } from '@/lib/auth/redirect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SignInFormProps = {
  redirectTo?: string | null;
};

export function SignInForm({ redirectTo: initialRedirectTo }: SignInFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    const redirectTo = getSafeRedirectPath(initialRedirectTo);

    if (typeof email !== 'string' || typeof password !== 'string') {
      setError('Email and password are required.');
      return;
    }

    startTransition(async () => {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
        callbackURL: redirectTo,
      });

      if (result.error) {
        setError(result.error.message || 'Unable to sign in.');
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-md border border-[#E8E8E8] bg-white p-8 shadow-[0_24px_80px_rgba(13,13,13,0.08)]">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#E42313]">
          EventPulse
        </p>
        <h1 className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight text-[#0D0D0D]">
          Sign in
        </h1>
        <p className="text-sm text-[#6C6C6C]">
          Continue to the analytics workspace with your admin credentials.
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#0D0D0D]" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@eventpulse.local"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-[#0D0D0D]"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[#7A7A7A] transition-colors hover:text-[#0D0D0D]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <IoEyeOffOutline className="h-[18px] w-[18px]" />
              ) : (
                <IoEyeOutline className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-sm border border-[#F3C2BE] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A02217]">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full bg-[#E42313] text-white hover:bg-[#C51E11]"
        >
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-xs text-[#6C6C6C]">
        API ingestion endpoints remain separate and continue to use application
        API keys. Authentication only gates the dashboard surface.
      </p>
    </div>
  );
}
