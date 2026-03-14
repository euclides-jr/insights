'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreateApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateApplicationDialog({
  open,
  onOpenChange,
}: CreateApplicationDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdApp, setCreatedApp] = useState<{
    id: string;
    name: string;
    apiKey: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create application');
      }

      setCreatedApp(data.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    setCreatedApp(null);
    setName('');
    setError(null);
    onOpenChange(false);
    router.refresh();
  };

  const handleCancel = () => {
    setName('');
    setError(null);
    setCreatedApp(null);
    onOpenChange(false);
  };

  // Success state - show API key
  if (createdApp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-600"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <DialogTitle>Application Created!</DialogTitle>
            </div>
            <DialogDescription>
              Your application has been created successfully. Save your API key
              securely - it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0A0A0A] mb-1.5">
                Application Name
              </label>
              <div className="px-3 py-2 bg-[#F5F5F5] rounded-md text-sm">
                {createdApp.name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0A0A0A] mb-1.5">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-[#F5F5F5] rounded-md text-sm font-mono break-all">
                  {createdApp.apiKey}
                </code>
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(createdApp.apiKey);
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-[#7A7A7A]">
                Use this API key to authenticate requests from your application.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleDone}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Form state
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Application</DialogTitle>
          <DialogDescription>
            Add a new application to start tracking events
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Application Name"
            placeholder="My Mobile App"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
            error={error || undefined}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Application'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
