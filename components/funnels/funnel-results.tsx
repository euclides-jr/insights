'use client';

import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';

export type FunnelResultStep = {
  position: number;
  eventName: string;
  users: number;
  conversionRate: number | null;
  dropOffRate: number | null;
};

export function FunnelResults({
  title,
  description,
  steps,
  testId,
}: {
  title: string;
  description: string;
  steps: FunnelResultStep[];
  testId?: string;
}) {
  return (
    <div className="space-y-6" data-testid={testId}>
      <div>
        <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[#7A7A7A]">{description}</p>
      </div>

      {steps.length === 0 ? (
        <div className="border border-dashed border-[#E8E8E8] bg-white px-6 py-8 text-sm text-[#7A7A7A]">
          No funnel results yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell width="80px" className="font-medium text-xs text-[#7A7A7A]">
                Step
              </TableCell>
              <TableCell width="220px" className="font-medium text-xs text-[#7A7A7A]">
                Event
              </TableCell>
              <TableCell width="120px" className="font-medium text-xs text-[#7A7A7A]">
                Users
              </TableCell>
              <TableCell width="160px" className="font-medium text-xs text-[#7A7A7A]">
                Conversion
              </TableCell>
              <TableCell width="160px" className="font-medium text-xs text-[#7A7A7A]">
                Drop-off
              </TableCell>
            </TableRow>
          </TableHeader>
          {steps.map((step) => (
            <TableRow key={step.position}>
              <TableCell width="80px">#{step.position}</TableCell>
              <TableCell width="220px" className="font-medium">
                {step.eventName}
              </TableCell>
              <TableCell width="120px">{step.users}</TableCell>
              <TableCell width="160px">
                {step.conversionRate === null
                  ? '—'
                  : `${(step.conversionRate * 100).toFixed(1)}%`}
              </TableCell>
              <TableCell width="160px">
                {step.dropOffRate === null
                  ? '—'
                  : `${(step.dropOffRate * 100).toFixed(1)}%`}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
    </div>
  );
}
