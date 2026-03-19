import type {
  Prisma,
  SavedReportType,
  WorkspaceMember,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  normalizeQueryDefinition,
  type QueryDefinition,
} from '@/lib/validations/query-schemas';

export type SavedReportConfig = Prisma.JsonObject;

export type CreateSavedReportInput = {
  name: string;
  reportType: SavedReportType;
  applicationId?: string | null;
  config: SavedReportConfig;
};

type LegacyQueryReportFilter = {
  key?: unknown;
  operator?: unknown;
  value?: unknown;
};

export function normalizeQueryReportConfig(
  config: Record<string, unknown>,
  applicationId?: string | null,
): QueryDefinition | null {
  const fallbackDates = {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  };

  const legacyMetric =
    typeof config.metric === 'string' &&
    ['count', 'unique_users', 'avg', 'sum'].includes(config.metric)
      ? config.metric
      : undefined;

  const legacyFilters = Array.isArray(config.filters)
    ? (config.filters as LegacyQueryReportFilter[])
    : [];

  const eventNameFilter = legacyFilters.find(
    (filter) =>
      filter.key === 'eventName' &&
      (filter.operator === 'eq' || filter.operator === 'in'),
  );

  const eventName =
    typeof config.eventName === 'string' && config.eventName.length > 0
      ? config.eventName
      : typeof eventNameFilter?.value === 'string'
        ? eventNameFilter.value
        : Array.isArray(eventNameFilter?.value) &&
            typeof eventNameFilter.value[0] === 'string'
          ? eventNameFilter.value[0]
          : undefined;

  const normalized = normalizeQueryDefinition({
    applicationId:
      (typeof config.applicationId === 'string' && config.applicationId) ||
      applicationId ||
      '',
    eventName,
    startDate:
      typeof config.startDate === 'string'
        ? config.startDate
        : fallbackDates.startDate,
    endDate:
      typeof config.endDate === 'string' ? config.endDate : fallbackDates.endDate,
    aggregation:
      typeof config.aggregation === 'string' ? config.aggregation : legacyMetric,
    aggregationField:
      typeof config.aggregationField === 'string'
        ? config.aggregationField
        : undefined,
    groupBy:
      typeof config.groupBy === 'string' || typeof config.groupBy === 'object'
        ? (config.groupBy as QueryDefinition['groupBy'])
        : undefined,
    sort:
      typeof config.sort === 'object' && config.sort
        ? (config.sort as QueryDefinition['sort'])
        : undefined,
    pageSize:
      typeof config.pageSize === 'number' ? config.pageSize : undefined,
    propertyFilters: Array.isArray(config.propertyFilters)
      ? config.propertyFilters
      : undefined,
  });

  return normalized;
}

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
