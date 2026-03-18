import type {
  Prisma,
  SavedReportType,
  WorkspaceMember,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type SavedReportConfig = Prisma.JsonObject;

export type CreateSavedReportInput = {
  name: string;
  reportType: SavedReportType;
  applicationId?: string | null;
  config: SavedReportConfig;
};

export async function listSavedReports(
  reportType?: SavedReportType,
  applicationId?: string,
) {
  return prisma.savedReport.findMany({
    where: {
      ...(reportType ? { reportType } : {}),
      ...(applicationId ? { applicationId } : {}),
    },
    include: {
      application: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createSavedReport(
  membership: WorkspaceMember,
  input: CreateSavedReportInput,
) {
  return prisma.savedReport.create({
    data: {
      name: input.name,
      reportType: input.reportType,
      applicationId: input.applicationId ?? null,
      config: input.config,
      createdByUserId: membership.userId,
      updatedByUserId: membership.userId,
    },
    include: {
      application: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function getSavedReport(id: string) {
  return prisma.savedReport.findUnique({
    where: { id },
    include: {
      application: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function updateSavedReport(
  id: string,
  membership: WorkspaceMember,
  input: Partial<CreateSavedReportInput>,
) {
  return prisma.savedReport.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.reportType !== undefined ? { reportType: input.reportType } : {}),
      ...(input.applicationId !== undefined
        ? { applicationId: input.applicationId }
        : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      updatedByUserId: membership.userId,
    },
    include: {
      application: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function deleteSavedReport(
  id: string,
  membership: WorkspaceMember,
) {
  void membership;
  return prisma.savedReport.delete({
    where: { id },
  });
}
