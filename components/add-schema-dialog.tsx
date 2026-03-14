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
import { SchemaForm } from '@/components/schema-form';

interface Application {
  id: string;
  name: string;
}

export function AddSchemaDialog({
  applications,
}: {
  applications: Application[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add Schema</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[720px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Create Event Schema</DialogTitle>
            <DialogDescription>
              Define the expected properties for an event type. Active schemas
              will validate incoming events and reject those that don&apos;t
              conform.
            </DialogDescription>
          </DialogHeader>

          <SchemaForm
            applications={applications}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
