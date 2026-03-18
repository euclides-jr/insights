'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type ApplicationOption = {
  id: string;
  name: string;
};

type InitialReport = {
  id: string;
  name: string;
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId: string | null;
  config: Record<string, unknown>;
};

type DraftReport = {
  name?: string;
  reportType?: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId?: string | null;
  config?: Record<string, unknown>;
};

export function ReportForm({
  applications,
  onSuccess,
  initialReport,
  draftReport,
}: {
  applications: ApplicationOption[];
  onSuccess: () => void;
  initialReport?: InitialReport;
  draftReport?: DraftReport;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialReport?.name ?? draftReport?.name ?? '');
  const [reportType, setReportType] = useState<
    'QUERY' | 'FUNNEL' | 'RETENTION'
  >(initialReport?.reportType ?? draftReport?.reportType ?? 'FUNNEL');
  const [applicationId, setApplicationId] = useState(
    initialReport?.applicationId ??
      draftReport?.applicationId ??
      applications[0]?.id ??
      '',
  );
  const [configJson, setConfigJson] = useState(
    JSON.stringify(
      initialReport?.config ??
        draftReport?.config ?? {
        timeWindow: { value: 30, unit: 'days' },
      },
      null,
      2,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(initialReport);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const parsedConfig = JSON.parse(configJson) as Record<string, unknown>;

      const response = await fetch(
        initialReport ? `/api/reports/${initialReport.id}` : '/api/reports',
        {
          method: initialReport ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            reportType,
            applicationId: applicationId || undefined,
            config: parsedConfig,
          }),
        },
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Failed to ${initialReport ? 'update' : 'create'} report`,
        );
      }

      router.refresh();
      onSuccess();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `Failed to ${initialReport ? 'update' : 'create'} report`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Report Name"
        placeholder="Signup Funnel (30d)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={isSubmitting}
        required
        error={error ?? undefined}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#0A0A0A]">
            Report Type
          </label>
          <select
            aria-label="Report Type"
            className="h-10 w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm"
            value={reportType}
            onChange={(event) =>
              setReportType(
                event.target.value as 'QUERY' | 'FUNNEL' | 'RETENTION',
              )
            }
            disabled={isSubmitting}
          >
            <option value="QUERY">Query</option>
            <option value="FUNNEL">Funnel</option>
            <option value="RETENTION">Retention</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#0A0A0A]">
            Application
          </label>
          <select
            aria-label="Application"
            className="h-10 w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
            disabled={isSubmitting}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#0A0A0A]">
          Config JSON
        </label>
        <textarea
          aria-label="Config JSON"
          className="min-h-[220px] w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 font-mono text-sm"
          value={configJson}
          onChange={(event) => setConfigJson(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? 'Saving…'
              : 'Creating…'
            : isEditing
              ? 'Save Changes'
              : 'Create Report'}
        </Button>
      </DialogFooter>
    </form>
  );
}
