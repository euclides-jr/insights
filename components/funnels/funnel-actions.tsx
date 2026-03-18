'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FunnelForm } from '@/components/funnels/funnel-form';

type ApplicationOption = {
  id: string;
  name: string;
};

type FunnelRecord = {
  id: string;
  applicationId: string;
  name: string;
  description: string | null;
  steps: Array<{
    id: string;
    eventName: string;
  }>;
};

export function FunnelActions({
  applications,
  funnel,
}: {
  applications: ApplicationOption[];
  funnel: FunnelRecord;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/funnels/${funnel.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete funnel');
      }

      router.refresh();
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Failed to delete funnel',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
        Delete
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[720px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Funnel</DialogTitle>
            <DialogDescription>
              Update the funnel definition and step order.
            </DialogDescription>
          </DialogHeader>

          <FunnelForm
            applications={applications}
            initialFunnel={funnel}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Funnel</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium">{funnel.name}</span>.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <p className="text-sm text-red-500">{deleteError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete Funnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
