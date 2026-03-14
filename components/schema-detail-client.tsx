'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SchemaForm } from '@/components/schema-form';

interface PropertyRow {
  id: string;
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
}

interface Application {
  id: string;
  name: string;
}

interface SchemaDetailClientProps {
  schemaId: string;
  isActive: boolean;
  applications: Application[];
  defaultProperties: PropertyRow[];
}

export function SchemaDetailClient({
  schemaId,
  isActive,
  applications,
  defaultProperties,
}: SchemaDetailClientProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/schemas/${schemaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !isActive }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Failed to update schema status');
          return;
        }
        router.refresh();
      } catch {
        setError('Network error — please try again');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Toggle active / inactive */}
      <Button
        variant="secondary"
        onClick={handleToggleActive}
        disabled={isPending}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>

      {/* Edit (new version) */}
      {isActive && (
        <Button onClick={() => setEditOpen(true)}>Edit Schema</Button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[720px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Schema</DialogTitle>
            <DialogDescription>
              Saving changes will deactivate the current version and create a
              new version with an incremented version number.
            </DialogDescription>
          </DialogHeader>

          <SchemaForm
            applications={applications}
            schemaId={schemaId}
            defaultProperties={defaultProperties}
            onSuccess={() => setEditOpen(false)}
            isEditMode={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
