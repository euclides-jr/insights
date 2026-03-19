'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function InviteMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>('VIEWER');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          expiresInDays,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setInviteUrl(data.inviteUrl);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to create invitation',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEmail('');
      setRole('VIEWER');
      setExpiresInDays(7);
      setInviteUrl(null);
      setError(null);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Invite Member</Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Create a workspace invitation for a viewer, editor, or admin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="viewer@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#0A0A0A]">
                  Role
                </label>
                <select
                  aria-label="Role"
                  className={selectInputClass}
                  style={selectChevronStyle}
                  value={role}
                  onChange={(event) =>
                    setRole(
                      event.target.value as 'VIEWER' | 'EDITOR' | 'ADMIN',
                    )
                  }
                  disabled={isSubmitting}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#0A0A0A]">
                  Expires In
                </label>
                <select
                  aria-label="Expires In"
                  className={selectInputClass}
                  style={selectChevronStyle}
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(Number(event.target.value))}
                  disabled={isSubmitting}
                >
                  {Array.from({ length: 14 }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value} day{value === 1 ? '' : 's'}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {inviteUrl ? (
              <div className="border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-4 text-sm">
                <p className="font-medium text-[#0D0D0D]">Invite URL</p>
                <p className="mt-2 break-all text-[#7A7A7A]">{inviteUrl}</p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Create Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
