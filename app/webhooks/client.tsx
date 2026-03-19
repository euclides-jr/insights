'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WebhookDialog } from '@/components/webhook-dialog';

interface WebhookRow {
  id: string;
  applicationId: string;
  name: string;
  url: string;
  secret: string | null;
  minLevel: string;
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastStatus: number | null;
  application: { id: string; name: string };
}

interface Application {
  id: string;
  name: string;
}

export function WebhookActions({
  webhook,
  applications,
}: {
  webhook: WebhookRow;
  applications: Application[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: number;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult({ success: data.success, status: data.status });
      router.refresh();
    } catch {
      setTestResult({ success: false, status: 0 });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);

    try {
      const response = await fetch(`/api/webhooks/${webhook.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete webhook');
      }

      router.refresh();
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Failed to delete webhook',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {testResult && (
        <span
          className={`text-xs font-medium ${
            testResult.success ? 'text-[#22C55E]' : 'text-[#EF4444]'
          }`}
        >
          {testResult.success
            ? `✓ ${testResult.status}`
            : testResult.status
              ? `✗ ${testResult.status}`
              : '✗ No response'}
        </span>
      )}
      <button
        onClick={handleTest}
        disabled={testing}
        className="text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors disabled:opacity-50"
      >
        {testing ? 'Testing…' : 'Test'}
      </button>
      <button
        onClick={() => setEditOpen(true)}
        className="text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => setDeleteOpen(true)}
        disabled={deleting}
        className="text-xs text-[#EF4444] hover:text-red-700 transition-colors disabled:opacity-50"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>

      <WebhookDialog
        applications={applications}
        initial={{
          id: webhook.id,
          applicationId: webhook.applicationId,
          name: webhook.name,
          url: webhook.url,
          secret: webhook.secret ?? '',
          minLevel: webhook.minLevel as 'warning' | 'error',
          isActive: webhook.isActive,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium">{webhook.name}</span>.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <p className="text-sm text-red-500">{deleteError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StatusCell({
  lastStatus,
  lastTriggeredAt,
}: {
  lastStatus: number | null;
  lastTriggeredAt: string | null;
}) {
  if (!lastTriggeredAt) {
    return <span className="text-sm text-[#7A7A7A]">Never triggered</span>;
  }

  const ok = lastStatus !== null && lastStatus >= 200 && lastStatus < 300;
  return (
    <div className="space-y-0.5">
      <Badge variant={ok ? 'success' : lastStatus ? 'error' : 'neutral'}>
        {lastStatus ? `HTTP ${lastStatus}` : 'No response'}
      </Badge>
    </div>
  );
}

export { Button };
