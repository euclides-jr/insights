'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FunnelResults, type FunnelResultStep } from '@/components/funnels/funnel-results';
import { SaveReportDialog } from '@/components/reports/save-report-dialog';

type FunnelOption = {
  id: string;
  name: string;
  applicationId: string;
};

const TIME_WINDOW_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

export function FunnelRunner({
  funnels,
  initialFunnelId,
  initialResults,
  applications,
}: {
  funnels: FunnelOption[];
  initialFunnelId?: string;
  initialResults: FunnelResultStep[];
  applications: Array<{ id: string; name: string }>;
}) {
  const [selectedFunnelId, setSelectedFunnelId] = useState(
    initialFunnelId ?? funnels[0]?.id ?? '',
  );
  const [timeWindowValue, setTimeWindowValue] = useState(30);
  const [results, setResults] = useState(initialResults);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFunnel =
    funnels.find((funnel) => funnel.id === selectedFunnelId) ?? null;

  async function handleRun() {
    if (!selectedFunnel) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/funnels/${selectedFunnel.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: selectedFunnel.applicationId,
          timeWindow: {
            value: timeWindowValue,
            unit: 'days',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run funnel');
      }

      setResults(data.steps);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : 'Failed to run funnel',
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border border-[#E8E8E8] bg-white px-6 py-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Saved Funnel
            </label>
            <select
              aria-label="Saved Funnel"
              className="h-10 w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm"
              value={selectedFunnelId}
              onChange={(event) => setSelectedFunnelId(event.target.value)}
              disabled={isRunning || funnels.length === 0}
            >
              {funnels.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[160px] space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Time Window
            </label>
            <select
              aria-label="Time Window"
              className="h-10 w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm"
              value={timeWindowValue}
              onChange={(event) => setTimeWindowValue(Number(event.target.value))}
              disabled={isRunning || funnels.length === 0}
            >
              {TIME_WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !selectedFunnel}
          >
            {isRunning ? 'Running…' : 'Run Funnel'}
          </Button>
          <SaveReportDialog
            applications={applications}
            draftReport={{
              name: selectedFunnel
                ? `${selectedFunnel.name} (${timeWindowValue}d)`
                : 'Funnel Report',
              reportType: 'FUNNEL',
              applicationId: selectedFunnel?.applicationId,
              config: selectedFunnel
                ? {
                    funnelId: selectedFunnel.id,
                    timeWindow: {
                      value: timeWindowValue,
                      unit: 'days',
                    },
                  }
                : {},
            }}
            buttonLabel="Save Current View"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </div>

      <FunnelResults
        title="Funnel Results"
        description={
          selectedFunnel
            ? `${selectedFunnel.name} over the last ${timeWindowValue} days`
            : 'Select a saved funnel to run it.'
        }
        steps={results}
        testId="funnel-runner-results"
      />
    </div>
  );
}
