import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['VIEWER', 'EDITOR', 'ADMIN']);

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema,
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export const listAuditEntriesSchema = z.object({
  actorUserId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  targetType: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
