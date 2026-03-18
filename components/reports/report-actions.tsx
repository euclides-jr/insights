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
import { ReportForm } from '@/components/reports/report-form';

type ApplicationOption = {
  id: string;
  name: string;
};

type ReportRecord = {
  id: string;
  name: string;
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION';
  applicationId: string | null;
  config: Record<string, unknown>;
};

export function ReportActions({
  applications,
  report,
}: {
  applications: ApplicationOption[];
  report: ReportRecord;
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
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete report');
      }

      router.refresh();
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Failed to delete report',
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
        <DialogContent className="w-[720px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Saved Report</DialogTitle>
            <DialogDescription>
              Update the saved configuration and metadata.
            </DialogDescription>
          </DialogHeader>

          <ReportForm
            applications={applications}
            initialReport={report}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium">{report.name}</span>.
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
              {isDeleting ? 'Deleting…' : 'Delete Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
