import type { PrismaClient, WorkspaceMember } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'jest-mock-extended';

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import {
  createSavedReport,
  deleteSavedReport,
  getSavedReport,
  listSavedReports,
  updateSavedReport,
} from '@/lib/services/report-service';
import { prismaMock } from './prisma-singleton';

const membership = {
  id: 'member-1',
  userId: 'user-1',
  role: 'EDITOR',
} as WorkspaceMember;

describe('report-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists reports with optional filters', async () => {
    prismaMock.savedReport.findMany.mockResolvedValueOnce([] as never);

    await listSavedReports('FUNNEL', 'app-1');

    expect(prismaMock.savedReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reportType: 'FUNNEL',
          applicationId: 'app-1',
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('creates a saved report with creator and updater ownership', async () => {
    prismaMock.savedReport.create.mockResolvedValueOnce({
      id: 'report-1',
      name: 'Signup Funnel',
    } as never);

    await createSavedReport(membership, {
      name: 'Signup Funnel',
      reportType: 'FUNNEL',
      applicationId: 'app-1',
      config: { funnelId: 'funnel-1' },
    });

    expect(prismaMock.savedReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Signup Funnel',
          reportType: 'FUNNEL',
          applicationId: 'app-1',
          config: { funnelId: 'funnel-1' },
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      }),
    );
  });

  it('loads a report by id', async () => {
    prismaMock.savedReport.findUnique.mockResolvedValueOnce({
      id: 'report-1',
    } as never);

    const result = await getSavedReport('report-1');

    expect(result?.id).toBe('report-1');
    expect(prismaMock.savedReport.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
      }),
    );
  });

  it('updates provided fields and stamps updatedByUserId', async () => {
    prismaMock.savedReport.update.mockResolvedValueOnce({
      id: 'report-1',
      name: 'Updated',
    } as never);

    await updateSavedReport('report-1', membership, {
      name: 'Updated',
      applicationId: null,
      config: { retention: true },
    });

    expect(prismaMock.savedReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: {
          name: 'Updated',
          applicationId: null,
          config: { retention: true },
          updatedByUserId: 'user-1',
        },
      }),
    );
  });

  it('deletes a report by id', async () => {
    prismaMock.savedReport.delete.mockResolvedValueOnce({ id: 'report-1' } as never);

    await deleteSavedReport('report-1', membership);

    expect(prismaMock.savedReport.delete).toHaveBeenCalledWith({
      where: { id: 'report-1' },
    });
  });
});
