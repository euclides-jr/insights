'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [deleting, setDeleting] = useState(false);

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
    if (!confirm(`Delete webhook "${webhook.name}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await fetch(`/api/webhooks/${webhook.id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      alert('Failed to delete webhook');
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
        onClick={handleDelete}
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
