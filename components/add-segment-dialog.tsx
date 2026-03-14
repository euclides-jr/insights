'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SegmentForm } from '@/components/segment-form';

interface Application {
  id: string;
  name: string;
}

export function AddSegmentDialog({
  applications,
}: {
  applications: Application[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add Segment</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Segment</DialogTitle>
            <DialogDescription>
              Define a group of users based on their event behaviour. The member
              count is evaluated immediately when you save.
            </DialogDescription>
          </DialogHeader>

          <SegmentForm
            applications={applications}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
