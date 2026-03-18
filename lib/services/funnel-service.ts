import type {
  Funnel,
  FunnelStep,
  Prisma,
  WorkspaceMember,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type FunnelWithSteps = Funnel & { steps: FunnelStep[] };

export type CreateFunnelInput = {
  applicationId: string;
  name: string;
  description?: string;
  steps: Array<{
    eventName: string;
    properties?: Record<string, unknown>;
  }>;
};

export type RunFunnelInput = {
  timeWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
};

export type FunnelStepResult = {
  position: number;
  eventName: string;
  users: number;
  conversionRate: number | null;
  dropOffRate: number | null;
};

export async function listFunnels(_applicationId?: string, _query?: string) {
  return prisma.funnel.findMany({
    where: {
      ...(_applicationId ? { applicationId: _applicationId } : {}),
      ...(_query
        ? {
            name: {
              contains: _query,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    include: {
      steps: {
        orderBy: { position: 'asc' },
      },
      application: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createFunnel(
  _membership: WorkspaceMember,
  _input: CreateFunnelInput,
) {
  return prisma.funnel.create({
    data: {
      applicationId: _input.applicationId,
      name: _input.name,
      description: _input.description,
      createdByUserId: _membership.userId,
      steps: {
        create: _input.steps.map((step, index) => ({
          position: index + 1,
          eventName: step.eventName,
          properties: step.properties as Prisma.InputJsonObject | undefined,
        })),
      },
    },
    include: {
      steps: {
        orderBy: { position: 'asc' },
      },
    },
  });
}

export async function getFunnel(_id: string): Promise<FunnelWithSteps | null> {
  return prisma.funnel.findUnique({
    where: { id: _id },
    include: {
      steps: {
        orderBy: { position: 'asc' },
      },
    },
  });
}

export async function updateFunnel(
  _id: string,
  _membership: WorkspaceMember,
  _input: Partial<CreateFunnelInput>,
) {
  return prisma.funnel.update({
    where: { id: _id },
    data: {
      ...(_input.applicationId ? { applicationId: _input.applicationId } : {}),
      ...(_input.name !== undefined ? { name: _input.name } : {}),
      ...(_input.description !== undefined
        ? { description: _input.description }
        : {}),
      ...(_input.steps
        ? {
            steps: {
              deleteMany: {},
              create: _input.steps.map((step, index) => ({
                position: index + 1,
                eventName: step.eventName,
                properties: step.properties as Prisma.InputJsonObject | undefined,
              })),
            },
          }
        : {}),
    },
    include: {
      steps: {
        orderBy: { position: 'asc' },
      },
    },
  });
}

export async function deleteFunnel(_id: string, _membership: WorkspaceMember) {
  void _membership;
  return prisma.funnel.delete({
    where: { id: _id },
  });
}

export async function runFunnel(
  _id: string,
  _input: RunFunnelInput,
): Promise<FunnelStepResult[]> {
  const funnel = await prisma.funnel.findUnique({
    where: { id: _id },
    include: {
      steps: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!funnel) {
    throw new Error(`Funnel ${_id} not found`);
  }

  const start = new Date();
  if (_input.timeWindow.unit === 'weeks') {
    start.setDate(start.getDate() - _input.timeWindow.value * 7);
  } else {
    start.setDate(start.getDate() - _input.timeWindow.value);
  }

  const params: unknown[] = [funnel.applicationId, start];
  let paramIdx = params.length;
  const ctes: string[] = [];
  const selects: string[] = [];

  for (const step of funnel.steps) {
    params.push(step.eventName);
    const eventNameParam = `$${++paramIdx}`;

    let propertiesConstraint = '';
    if (step.properties && Object.keys(step.properties as object).length > 0) {
      params.push(JSON.stringify(step.properties));
      propertiesConstraint = `AND e.properties @> $${++paramIdx}::jsonb`;
    }

    const cteName = `step${step.position}`;
    const previousCte =
      step.position > 1 ? `JOIN step${step.position - 1} prev ON prev."userId" = e."userId"` : '';
    const orderingConstraint =
      step.position > 1 ? 'AND e."timestamp" > prev.ts' : '';

    ctes.push(`
      ${cteName} AS (
        SELECT e."userId", MIN(e."timestamp") AS ts
        FROM events e
        ${previousCte}
        WHERE e."applicationId" = $1
          AND e."eventName" = ${eventNameParam}
          AND e."timestamp" >= $2
          ${orderingConstraint}
          ${propertiesConstraint}
        GROUP BY e."userId"
      )
    `);

    selects.push(`
      SELECT
        ${step.position}::int AS position,
        ${eventNameParam}::text AS "eventName",
        COUNT(*)::bigint AS users
      FROM ${cteName}
    `);
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{ position: number; eventName: string; users: bigint }>
  >(
    `
      WITH
      ${ctes.join(',\n')}
      ${selects.join('\nUNION ALL\n')}
      ORDER BY position ASC
    `,
    ...params,
  );

  return rows.map((row, index) => {
    const users = Number(row.users);
    const previousUsers = index > 0 ? Number(rows[index - 1]?.users ?? 0) : null;

    return {
      position: row.position,
      eventName: row.eventName,
      users,
      conversionRate:
        previousUsers && previousUsers > 0 ? users / previousUsers : null,
      dropOffRate:
        previousUsers && previousUsers > 0
          ? (previousUsers - users) / previousUsers
          : null,
    };
  });
}
