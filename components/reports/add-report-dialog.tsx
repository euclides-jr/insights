'use client';

import { SaveReportDialog } from '@/components/reports/save-report-dialog';

type ApplicationOption = {
  id: string;
  name: string;
};

export function AddReportDialog({
  applications,
}: {
  applications: ApplicationOption[];
}) {
  return (
    <SaveReportDialog
      applications={applications}
      draftReport={{
        reportType: 'FUNNEL',
        applicationId: applications[0]?.id,
        config: {
          timeWindow: { value: 30, unit: 'days' },
        },
      }}
      buttonLabel="+ Save Report"
      title="Create Saved Report"
      description="Save a query, funnel, or retention configuration for reuse."
    />
  );
}
