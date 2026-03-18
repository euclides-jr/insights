import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'jest-mock-extended';

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { runRetention } from '@/lib/services/retention-service';
import { prismaMock } from './prisma-singleton';

describe('retention-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds daily buckets and rates from cohort and activity rows', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          cohort_start: new Date('2026-03-10T00:00:00.000Z'),
          cohort_size: 4n,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          cohort_start: new Date('2026-03-10T00:00:00.000Z'),
          bucket_index: 0,
          users: 4n,
        },
        {
          cohort_start: new Date('2026-03-10T00:00:00.000Z'),
          bucket_index: 1,
          users: 2n,
        },
      ] as never);

    const result = await runRetention({
      applicationId: 'app-1',
      interval: 'daily',
      cohortWindow: { value: 7, unit: 'days' },
      returnEventName: 'purchase',
    });

    expect(result.buckets).toEqual(['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
    expect(result.cohorts).toEqual([
      {
        cohortStart: '2026-03-10T00:00:00.000Z',
        cohortSize: 4,
        cells: [
          { bucket: 'D0', users: 4, rate: 1 },
          { bucket: 'D1', users: 2, rate: 0.5 },
          { bucket: 'D2', users: 0, rate: 0 },
          { bucket: 'D3', users: 0, rate: 0 },
          { bucket: 'D4', users: 0, rate: 0 },
          { bucket: 'D5', users: 0, rate: 0 },
          { bucket: 'D6', users: 0, rate: 0 },
        ],
      },
    ]);

    const [cohortSql] = prismaMock.$queryRawUnsafe.mock.calls[0] ?? [];
    const [activitySql] = prismaMock.$queryRawUnsafe.mock.calls[1] ?? [];
    expect(String(cohortSql)).toContain(`DATE_TRUNC('day'`);
    expect(String(activitySql)).toContain(`AND e."eventName" = $4`);
  });

  it('builds weekly buckets and ignores out-of-range activity buckets', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          cohort_start: '2026-03-03T00:00:00.000Z',
          cohort_size: 3n,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          cohort_start: '2026-03-03T00:00:00.000Z',
          bucket_index: 0,
          users: 3n,
        },
        {
          cohort_start: '2026-03-03T00:00:00.000Z',
          bucket_index: 5,
          users: 1n,
        },
      ] as never);

    const result = await runRetention({
      applicationId: 'app-2',
      interval: 'weekly',
      cohortWindow: { value: 2, unit: 'weeks' },
    });

    expect(result.buckets).toEqual(['W0', 'W1']);
    expect(result.cohorts[0]?.cells).toEqual([
      { bucket: 'W0', users: 3, rate: 1 },
      { bucket: 'W1', users: 0, rate: 0 },
    ]);

    const [activitySql] = prismaMock.$queryRawUnsafe.mock.calls[1] ?? [];
    expect(String(activitySql)).toContain(`DATE_TRUNC('week'`);
  });
});
