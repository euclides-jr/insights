import { describe, expect, it } from 'vitest';
import {
  buildQueryExportFilename,
  formatQueryResultsAsCsv,
  formatQueryResultsAsJson,
} from '@/lib/query/export';

describe('query export helpers', () => {
  it('formats rows as CSV with proper escaping', () => {
    const csv = formatQueryResultsAsCsv([
      { group: 'USD', value: 120, note: 'plain' },
      { group: 'EUR', value: 75, note: 'contains,comma' },
      { group: 'GBP', value: 44, note: 'contains "quote"' },
    ]);

    expect(csv).toContain('group,value,note');
    expect(csv).toContain('USD,120,plain');
    expect(csv).toContain('EUR,75,"contains,comma"');
    expect(csv).toContain('GBP,44,"contains ""quote"""');
  });

  it('formats rows as readable JSON', () => {
    const json = formatQueryResultsAsJson([{ group: 'USD', value: 120 }]);

    expect(json).toBe('[\n  {\n    "group": "USD",\n    "value": 120\n  }\n]');
  });

  it('builds a predictable export filename', () => {
    const filename = buildQueryExportFilename({
      applicationName: 'Demo Web App',
      eventName: 'purchase',
      format: 'json',
      timestamp: new Date('2026-03-19T12:34:56.000Z'),
    });

    expect(filename).toBe(
      'query-results_demo-web-app_purchase_2026-03-19t12-34-56.json',
    );
  });
});
