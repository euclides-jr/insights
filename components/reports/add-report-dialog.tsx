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

export function AddReportDialog({
  applications,
}: {
  applications: ApplicationOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Save Report</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[720px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Create Saved Report</DialogTitle>
            <DialogDescription>
              Save a query, funnel, or retention configuration for reuse.
            </DialogDescription>
          </DialogHeader>

          <ReportForm applications={applications} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
