import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRole } from '@prisma/client';

vi.mock('@/lib/auth/roles', () => {
  class AuthError extends Error {
    status = 401;
    constructor(message = 'Authentication required') {
      super(message);
      this.name = 'AuthError';
    }
  }

  class ForbiddenError extends Error {
    status = 403;
    constructor(message = 'Forbidden') {
      super(message);
      this.name = 'ForbiddenError';
    }
  }

  return {
    AuthError,
    ForbiddenError,
    requireRole: vi.fn(),
  };
});

vi.mock('@/lib/services/report-service', () => ({
  createSavedReport: vi.fn(),
  deleteSavedReport: vi.fn(),
  getSavedReport: vi.fn(),
  listSavedReports: vi.fn(),
  updateSavedReport: vi.fn(),
}));

import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import {
  createSavedReport,
  deleteSavedReport,
  getSavedReport,
  listSavedReports,
  updateSavedReport,
} from '@/lib/services/report-service';
import { GET as listReportsRoute, POST as createReportRoute } from '@/app/api/reports/route';
import {
  DELETE as deleteReportRoute,
  GET as getReportRoute,
  PATCH as updateReportRoute,
} from '@/app/api/reports/[id]/route';

const membership = {
  id: 'member-1',
  userId: 'user-1',
  role: WorkspaceRole.EDITOR,
};

describe('reports api routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists reports for a viewer', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    vi.mocked(listSavedReports).mockResolvedValueOnce([
      { id: 'report-1', name: 'Signup Funnel' },
    ] as never);

    const response = await listReportsRoute(
      new NextRequest(
        'http://localhost:3000/api/reports?reportType=FUNNEL&applicationId=app-1',
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reports: [{ id: 'report-1', name: 'Signup Funnel' }],
    });
    expect(listSavedReports).toHaveBeenCalledWith('FUNNEL', 'app-1');
  });

  it('creates a report for an editor', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    vi.mocked(createSavedReport).mockResolvedValueOnce({
      id: 'report-1',
      name: 'Signup Funnel',
    } as never);

    const response = await createReportRoute(
      new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Signup Funnel',
          reportType: 'FUNNEL',
          applicationId: 'app-1',
          config: { funnelId: 'funnel-1' },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: 'report-1',
      name: 'Signup Funnel',
    });
  });

  it('gets, updates, and deletes a report by id', async () => {
    vi.mocked(requireRole).mockResolvedValue(membership as never);
    vi.mocked(getSavedReport)
      .mockResolvedValueOnce({ id: 'report-1' } as never)
      .mockResolvedValueOnce({ id: 'report-1' } as never)
      .mockResolvedValueOnce({ id: 'report-1' } as never);
    vi.mocked(updateSavedReport).mockResolvedValueOnce({
      id: 'report-1',
      name: 'Updated',
    } as never);
    vi.mocked(deleteSavedReport).mockResolvedValueOnce(undefined as never);

    const getResponse = await getReportRoute(
      new NextRequest('http://localhost:3000/api/reports/report-1'),
      { params: Promise.resolve({ id: 'report-1' }) },
    );
    expect(getResponse.status).toBe(200);

    const patchResponse = await updateReportRoute(
      new NextRequest('http://localhost:3000/api/reports/report-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'report-1' }) },
    );
    expect(patchResponse.status).toBe(200);

    const deleteResponse = await deleteReportRoute(
      new NextRequest('http://localhost:3000/api/reports/report-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'report-1' }) },
    );
    expect(deleteResponse.status).toBe(204);
  });

  it('maps auth, forbidden, validation, and 404 cases', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthError());

    const unauthorized = await listReportsRoute(
      new NextRequest('http://localhost:3000/api/reports'),
    );
    expect(unauthorized.status).toBe(401);

    vi.mocked(requireRole).mockRejectedValueOnce(new ForbiddenError());
    const forbidden = await createReportRoute(
      new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Signup Funnel',
          reportType: 'FUNNEL',
          config: {},
        }),
      }),
    );
    expect(forbidden.status).toBe(403);

    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    const invalid = await createReportRoute(
      new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          reportType: 'BAD',
          config: [],
        }),
      }),
    );
    expect(invalid.status).toBe(400);

    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    vi.mocked(getSavedReport).mockResolvedValueOnce(null);
    const missing = await getReportRoute(
      new NextRequest('http://localhost:3000/api/reports/missing'),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(missing.status).toBe(404);
  });
});
