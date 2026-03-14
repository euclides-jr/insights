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
import { SegmentForm } from '@/components/segment-form';

interface EventFilter {
  id: string;
  eventName: string;
  countMin: string;
  countMax: string;
  timeWindowValue: string;
  timeWindowUnit: 'days' | 'hours';
  useTimeWindow: boolean;
}

interface Application {
  id: string;
  name: string;
}

interface SegmentDetailClientProps {
  segmentId: string;
  segmentName: string;
  description?: string | null;
  defaultLogic: 'AND' | 'OR';
  defaultFilters: EventFilter[];
  applicationId: string;
  applications: Application[];
}

export function SegmentDetailClient({
  segmentId,
  segmentName,
  description,
  defaultLogic,
  defaultFilters,
  applicationId,
  applications,
}: SegmentDetailClientProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/segments/${segmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: true }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Failed to refresh segment');
          return;
        }
        router.refresh();
      } catch {
        setError('Network error — please try again');
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/segments/${segmentId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          let msg = 'Failed to delete segment';
          try {
            const data = await res.json();
            msg = data.error ?? msg;
          } catch { /* ignore */ }
          setError(msg);
          setDeleteOpen(false);
          return;
        }
        router.push('/segments');
      } catch {
        setError('Network error — please try again');
        setDeleteOpen(false);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? 'Refreshing…' : 'Refresh Count'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setEditOpen(true)}
          disabled={isPending}
        >
          Edit
        </Button>
        <a
          href={`/api/segments/${segmentId}/export?format=csv`}
          download
          className="inline-flex items-center justify-center h-8 px-4 text-sm font-medium border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] transition-colors"
        >
          Export CSV
        </a>
        <a
          href={`/api/segments/${segmentId}/export?format=json`}
          download
          className="inline-flex items-center justify-center h-8 px-4 text-sm font-medium border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] transition-colors"
        >
          Export JSON
        </a>
        <Button
          variant="secondary"
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
          className="text-[#E42313] border-[#E42313]/20 hover:bg-[#E42313]/5"
        >
          Delete
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-[#E42313]">{error}</p>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
            <DialogDescription>
              Update the name, description, or event filters. The member count
              will be recalculated after saving.
            </DialogDescription>
          </DialogHeader>
          <SegmentForm
            applications={applications}
            segmentId={segmentId}
            defaultApplicationId={applicationId}
            defaultName={segmentName}
            defaultDescription={description ?? ''}
            defaultFilters={defaultFilters}
            defaultLogic={defaultLogic}
            isEditMode
            onSuccess={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Segment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{segmentName}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isPending}
              className="bg-[#E42313] text-white hover:bg-[#C41E10]"
            >
              {isPending ? 'Deleting…' : 'Delete Segment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
