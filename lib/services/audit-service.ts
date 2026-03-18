import type { AuditLogEntry, Prisma } from '@prisma/client';

export type AuditMetadata = Prisma.JsonObject | undefined;

export type CreateAuditLogEntryInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: AuditMetadata;
};

export async function appendAuditLogEntry(
  _input: CreateAuditLogEntryInput,
): Promise<AuditLogEntry> {
  void _input;
  throw new Error('not implemented');
}

export async function listAuditLogEntries(_input: {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  page: number;
  pageSize: number;
}) {
  void _input;
  throw new Error('not implemented');
}
