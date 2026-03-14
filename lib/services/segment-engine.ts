/**
 * Segment Engine
 *
 * Evaluates segment criteria against the events table to find matching users.
 *
 * Criteria shape:
 * {
 *   logic: "AND" | "OR",
 *   eventFilters: Array<{
 *     eventName: string;
 *     count?: { min?: number; max?: number };
 *     timeWindow?: { value: number; unit: "days" | "hours" };
 *     properties?: Record<string, unknown>;
 *   }>
 * }
 */

import { prisma } from '@/lib/db/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EventFilter {
  eventName: string;
  count?: { min?: number; max?: number };
  timeWindow?: { value: number; unit: 'days' | 'hours' };
  properties?: Record<string, unknown>;
}

export interface SegmentCriteria {
  logic: 'AND' | 'OR';
  eventFilters: EventFilter[];
}

export interface SegmentMember {
  userId: string;
  lastEventDate: string;
  eventCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function windowStart(filter: EventFilter): Date | null {
  if (!filter.timeWindow) return null;
  const now = new Date();
  const { value, unit } = filter.timeWindow;
  if (unit === 'hours') {
    return new Date(now.getTime() - value * 60 * 60 * 1000);
  }
  return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
}

/**
 * Build Prisma `where` clauses for a single event filter.
 * Returns the set of matching userIds.
 */
async function getUsersMatchingFilter(
  applicationId: string,
  filter: EventFilter,
): Promise<Set<string>> {
  const start = windowStart(filter);

  // Build the base where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    applicationId,
    eventName: filter.eventName,
    ...(start ? { timestamp: { gte: start } } : {}),
  };

  // Add property filters (exact equality on JSONB path)
  if (filter.properties && Object.keys(filter.properties).length > 0) {
    where.AND = Object.entries(filter.properties).map(([key, value]) => ({
      properties: {
        path: [key],
        equals: value,
      },
    }));
  }

  // Aggregate event counts per user
  const grouped = await prisma.event.groupBy({
    by: ['userId'],
    where,
    _count: { userId: true },
  });

  // Apply count filter
  const { min, max } = filter.count ?? {};
  const matched = grouped.filter((row) => {
    const c = row._count.userId;
    if (min !== undefined && c < min) return false;
    if (max !== undefined && c > max) return false;
    return true;
  });

  return new Set(matched.map((r) => r.userId));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the set of matching userIds for the given criteria
 * against the specified application's events.
 */
export async function evaluateSegment(
  applicationId: string,
  criteria: SegmentCriteria,
): Promise<Set<string>> {
  if (!criteria.eventFilters || criteria.eventFilters.length === 0) {
    return new Set();
  }

  const filterSets = await Promise.all(
    criteria.eventFilters.map((f) => getUsersMatchingFilter(applicationId, f)),
  );

  if (filterSets.length === 0) return new Set();

  if (criteria.logic === 'OR') {
    const union = new Set<string>();
    for (const s of filterSets) s.forEach((u) => union.add(u));
    return union;
  }

  // AND: intersection
  let result = filterSets[0];
  for (let i = 1; i < filterSets.length; i++) {
    result = new Set([...result].filter((u) => filterSets[i].has(u)));
  }
  return result;
}

/**
 * Returns the full member list with metadata (lastEventDate, eventCount)
 * for export or display purposes.
 */
export async function getSegmentMembers(
  applicationId: string,
  criteria: SegmentCriteria,
): Promise<SegmentMember[]> {
  const userIds = await evaluateSegment(applicationId, criteria);
  if (userIds.size === 0) return [];

  // For each matching user, fetch the most recent event date and total count
  const rows = await prisma.event.groupBy({
    by: ['userId'],
    where: {
      applicationId,
      userId: { in: [...userIds] },
    },
    _max: { timestamp: true },
    _count: { userId: true },
  });

  return rows.map((r) => ({
    userId: r.userId,
    lastEventDate: (r._max.timestamp ?? new Date()).toISOString(),
    eventCount: r._count.userId,
  }));
}

/**
 * Refreshes the memberCount on a segment record and returns the new count.
 */
export async function refreshSegmentCount(segmentId: string): Promise<number> {
  const segment = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: { applicationId: true, criteria: true },
  });
  if (!segment) throw new Error(`Segment ${segmentId} not found`);

  const userIds = await evaluateSegment(
    segment.applicationId,
    segment.criteria as unknown as SegmentCriteria,
  );

  await prisma.segment.update({
    where: { id: segmentId },
    data: { memberCount: userIds.size, lastRefreshedAt: new Date() },
  });

  return userIds.size;
}
