'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreateApplicationDialog } from '@/components/create-application-form';

export function ApplicationsHeader() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
            Applications
          </h1>
          <p className="mt-2 text-sm text-[#7A7A7A]">
            Manage applications that send events to the platform
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          + Add Application
        </Button>
      </div>

      <CreateApplicationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
