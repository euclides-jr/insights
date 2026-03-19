import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'jest-mock-extended';

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { executeQuery } from '@/lib/services/query-builder';
import { prismaMock } from './prisma-singleton';

describe('query-builder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds typed property filter SQL for numeric comparisons', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(1) }] as never)
      .mockResolvedValueOnce([{ group: 'USD', value: BigInt(10) }] as never);

    await executeQuery({
      applicationId: 'app-1',
      eventName: 'purchase',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.999Z',
      aggregation: 'count',
      propertyFilters: [
        {
          key: 'amount',
          valueType: 'number',
          operator: 'gt',
          value: 100,
        },
      ],
      groupBy: { kind: 'property', key: 'currency' },
    });

    const [, groupedSql] = prismaMock.$queryRawUnsafe.mock.calls;
    expect(groupedSql?.[0]).toContain(`jsonb_typeof(properties->'amount') = 'number'`);
    expect(groupedSql?.[0]).toContain(`(properties->>'amount')::numeric > $`);
  });

  it('uses date_trunc for time bucket grouping and returns pagination', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(4) }] as never)
      .mockResolvedValueOnce([{ group: new Date('2026-03-01T00:00:00.000Z'), value: BigInt(8) }] as never);

    const result = await executeQuery({
      applicationId: 'app-1',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.999Z',
      aggregation: 'count',
      groupBy: { kind: 'time', bucket: 'day' },
      page: 1,
      pageSize: 2,
    });

    const [, groupedSql] = prismaMock.$queryRawUnsafe.mock.calls;
    expect(groupedSql?.[0]).toContain(`date_trunc('day', "timestamp")`);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });
    expect(result.results[0]?.group).toBe('2026-03-01T00:00:00.000Z');
  });
});
