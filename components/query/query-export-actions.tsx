'use client';

import { Button } from '@/components/ui/button';
import {
  buildQueryExportFilename,
  formatQueryResultsAsCsv,
  formatQueryResultsAsJson,
  type QueryExportRow,
} from '@/lib/query/export';

function downloadFile(
  content: string,
  mimeType: string,
  filename: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QueryExportActions({
  rows,
  applicationName,
  eventName,
}: {
  rows: QueryExportRow[];
  applicationName?: string;
  eventName?: string;
}) {
  const disabled = rows.length === 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() =>
          downloadFile(
            formatQueryResultsAsCsv(rows),
            'text/csv;charset=utf-8',
            buildQueryExportFilename({
              applicationName,
              eventName,
              format: 'csv',
            }),
          )
        }
      >
        Export CSV
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() =>
          downloadFile(
            formatQueryResultsAsJson(rows),
            'application/json;charset=utf-8',
            buildQueryExportFilename({
              applicationName,
              eventName,
              format: 'json',
            }),
          )
        }
      >
        Export JSON
      </Button>
    </div>
  );
}
