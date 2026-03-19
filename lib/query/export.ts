export type QueryExportRow = Record<string, unknown>;

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export function formatQueryResultsAsCsv(rows: QueryExportRow[]) {
  if (rows.length === 0) {
    return '';
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key);
      }
      return set;
    }, new Set<string>()),
  );

  const header = columns.join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column])).join(','),
  );

  return [header, ...body].join('\n');
}

export function formatQueryResultsAsJson(rows: QueryExportRow[]) {
  return JSON.stringify(rows, null, 2);
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildQueryExportFilename(input?: {
  applicationName?: string;
  eventName?: string;
  format?: 'csv' | 'json';
  timestamp?: Date;
}) {
  const timestamp = (input?.timestamp ?? new Date()).toISOString().slice(0, 19);
  const parts = [
    'query-results',
    input?.applicationName ? sanitizeFilenamePart(input.applicationName) : null,
    input?.eventName ? sanitizeFilenamePart(input.eventName) : null,
    sanitizeFilenamePart(timestamp),
  ].filter(Boolean);

  return `${parts.join('_')}.${input?.format ?? 'csv'}`;
}
