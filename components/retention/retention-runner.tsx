'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';
import { SaveReportDialog } from '@/components/reports/save-report-dialog';
import {
  RetentionGrid,
} from '@/components/retention/retention-grid';
import { type RetentionResult } from '@/lib/services/retention-service';

type ApplicationOption = {
  id: string;
  name: string;
};

export function RetentionRunner({
  applications,
  initialResult,
}: {
  applications: ApplicationOption[];
  initialResult: RetentionResult | null;
}) {
  const [applicationId, setApplicationId] = useState(
    initialResult?.applicationId ?? applications[0]?.id ?? '',
  );
  const [interval, setInterval] = useState<'daily' | 'weekly'>(
    initialResult?.interval ?? 'weekly',
  );
  const [windowValue, setWindowValue] = useState(4);
  const [windowUnit, setWindowUnit] = useState<'days' | 'weeks'>('weeks');
  const [returnEventName, setReturnEventName] = useState('');
  const [result, setResult] = useState<RetentionResult | null>(initialResult);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch('/api/retention/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId,
          interval,
          cohortWindow: {
            value: windowValue,
            unit: windowUnit,
          },
          returnEventName: returnEventName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run retention');
      }

      setResult(data);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : 'Failed to run retention',
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="border border-[#E8E8E8] bg-white px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Application
            </label>
            <select
              aria-label="Application"
              className={selectInputClass}
              style={selectChevronStyle}
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              disabled={isRunning || applications.length === 0}
            >
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Interval
            </label>
            <select
              aria-label="Interval"
              className={selectInputClass}
              style={selectChevronStyle}
              value={interval}
              onChange={(event) =>
                setInterval(event.target.value as 'daily' | 'weekly')
              }
              disabled={isRunning}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Window Size
            </label>
            <select
              aria-label="Window Size"
              className={selectInputClass}
              style={selectChevronStyle}
              value={windowValue}
              onChange={(event) => setWindowValue(Number(event.target.value))}
              disabled={isRunning}
            >
              {Array.from({ length: 14 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0A0A0A]">
              Window Unit
            </label>
            <select
              aria-label="Window Unit"
              className={selectInputClass}
              style={selectChevronStyle}
              value={windowUnit}
              onChange={(event) =>
                setWindowUnit(event.target.value as 'days' | 'weeks')
              }
              disabled={isRunning}
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>

          <Input
            aria-label="Return Event"
            label="Return Event"
            placeholder="purchase"
            value={returnEventName}
            onChange={(event) => setReturnEventName(event.target.value)}
            disabled={isRunning}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-[#7A7A7A]">
            Cohorts are grouped by first activity inside the selected lookback window.
          </p>
          <Button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !applicationId}
          >
            {isRunning ? 'Running…' : 'Run Retention'}
          </Button>
          <SaveReportDialog
            applications={applications}
            draftReport={{
              name: `Retention ${interval} ${windowValue}${windowUnit === 'weeks' ? 'w' : 'd'}`,
              reportType: 'RETENTION',
              applicationId,
              config: {
                interval,
                cohortWindow: {
                  value: windowValue,
                  unit: windowUnit,
                },
                ...(returnEventName.trim()
                  ? { returnEventName: returnEventName.trim() }
                  : {}),
              },
            }}
            buttonLabel="Save Current View"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </div>

      {result ? (
        <RetentionGrid
          result={result}
          description={`${
            returnEventName.trim() || 'Any event'
          } return activity across ${result.interval} cohorts.`}
        />
      ) : (
        <div className="border border-dashed border-[#E8E8E8] bg-white px-6 py-8 text-sm text-[#7A7A7A]">
          Select an application and run a retention query.
        </div>
      )}
    </div>
  );
}
