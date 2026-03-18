import { z } from 'zod';

export const savedReportTypeSchema = z.enum(['QUERY', 'FUNNEL', 'RETENTION']);

export const createSavedReportSchema = z.object({
  name: z.string().min(1).max(120),
  reportType: savedReportTypeSchema,
  applicationId: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()),
});

export const updateSavedReportSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  applicationId: z.string().min(1).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const listSavedReportsSchema = z.object({
  reportType: savedReportTypeSchema.optional(),
  applicationId: z.string().min(1).optional(),
});
