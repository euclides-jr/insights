'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Application {
  id: string;
  name: string;
}

interface WebhookFormValues {
  id?: string;
  applicationId: string;
  name: string;
  url: string;
  secret: string;
  minLevel: 'warning' | 'error';
  isActive: boolean;
}

interface WebhookDialogProps {
  applications: Application[];
  initial?: WebhookFormValues;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function WebhookForm({
  applications,
  initial,
  onClose,
}: {
  applications: Application[];
  initial?: WebhookFormValues;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [values, setValues] = useState<WebhookFormValues>({
    applicationId: initial?.applicationId ?? applications[0]?.id ?? '',
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    secret: '',
    minLevel: initial?.minLevel ?? 'error',
    isActive: initial?.isActive ?? true,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof WebhookFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  function validate() {
    const e: typeof errors = {};
    if (!values.name.trim()) e.name = 'Name is required';
    if (!values.url.trim()) {
      e.url = 'URL is required';
    } else {
      try {
        new URL(values.url);
      } catch {
        e.url = 'Must be a valid URL';
      }
    }
    if (!values.applicationId) e.applicationId = 'Application is required';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    setServerError('');

    try {
      const body: Record<string, unknown> = {
        applicationId: values.applicationId,
        name: values.name.trim(),
        url: values.url.trim(),
        minLevel: values.minLevel,
        isActive: values.isActive,
      };
      // Only include secret if user typed one
      if (values.secret.trim()) body.secret = values.secret.trim();
      // For edit, null secret clears it
      if (isEdit && !values.secret.trim()) body.secret = null;

      const url = isEdit ? `/api/webhooks/${initial!.id}` : '/api/webhooks';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setServerError(data.error ?? 'Something went wrong');
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setServerError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 mt-2">
      {/* Application */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#0A0A0A]">
          Application
        </label>
        <select
          value={values.applicationId}
          onChange={(e) =>
            setValues((v) => ({ ...v, applicationId: e.target.value }))
          }
          className="flex h-10 w-full border border-[#E8E8E8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
        >
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors.applicationId && (
          <p className="text-xs text-red-500">{errors.applicationId}</p>
        )}
      </div>

      {/* Name */}
      <Input
        label="Name"
        placeholder="e.g. Slack #data-alerts"
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        error={errors.name}
      />

      {/* URL */}
      <Input
        label="Endpoint URL"
        placeholder="https://hooks.example.com/webhook"
        value={values.url}
        onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
        error={errors.url}
      />

      {/* Secret */}
      <Input
        label={
          isEdit
            ? 'New signing secret (leave blank to keep existing)'
            : 'Signing secret (optional)'
        }
        placeholder="Used for HMAC-SHA256 X-Webhook-Signature header"
        value={values.secret}
        type="password"
        onChange={(e) => setValues((v) => ({ ...v, secret: e.target.value }))}
      />

      {/* Min level */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#0A0A0A]">
          Trigger when alert level is at least
        </label>
        <div className="flex gap-3">
          {(['warning', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setValues((v) => ({ ...v, minLevel: lvl }))}
              className={`px-4 h-9 text-sm border transition-colors ${
                values.minLevel === lvl
                  ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]'
                  : 'border-[#E8E8E8] text-[#7A7A7A] hover:bg-[#FAFAFA]'
              }`}
            >
              {lvl === 'warning' ? 'Warning or Error' : 'Error only'}
            </button>
          ))}
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={values.isActive}
          onClick={() => setValues((v) => ({ ...v, isActive: !v.isActive }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            values.isActive ? 'bg-[#0D0D0D]' : 'bg-[#E8E8E8]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              values.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-[#0A0A0A]">
          {values.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create webhook'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function WebhookDialog({
  applications,
  initial,
  open,
  onOpenChange,
}: WebhookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? 'Edit Webhook' : 'Add Webhook'}
          </DialogTitle>
          <DialogDescription>
            EventPulse will POST a signed JSON payload to this URL whenever a
            data quality threshold is breached.
          </DialogDescription>
        </DialogHeader>
        <WebhookForm
          applications={applications}
          initial={initial}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Add-webhook button (used in the page header) ────────────────────────────

export function AddWebhookButton({
  applications,
}: {
  applications: Application[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add Webhook</Button>
      <WebhookDialog
        applications={applications}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
