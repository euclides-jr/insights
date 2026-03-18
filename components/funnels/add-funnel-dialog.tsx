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
import { FunnelForm } from '@/components/funnels/funnel-form';

type ApplicationOption = {
  id: string;
  name: string;
};

export function AddFunnelDialog({
  applications,
}: {
  applications: ApplicationOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add Funnel</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[720px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Funnel</DialogTitle>
            <DialogDescription>
              Define an ordered sequence of events and save it as a reusable
              conversion analysis.
            </DialogDescription>
          </DialogHeader>

          <FunnelForm
            applications={applications}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
