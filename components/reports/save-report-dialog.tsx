'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReportForm } from '@/components/reports/report-form';

type ApplicationOption = {
  id: string;
  name: string;
};

type DraftReport = {
  name?: string;
  reportType?: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId?: string | null;
  config?: Record<string, unknown>;
};

export function SaveReportDialog({
  applications,
  draftReport,
  buttonLabel = 'Save Report',
  title = 'Save Current View',
  description = 'Persist the current analytics configuration so it can be reopened later.',
}: {
  applications: ApplicationOption[];
  draftReport: DraftReport;
  buttonLabel?: string;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[720px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <ReportForm
            applications={applications}
            draftReport={draftReport}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
