import { z } from 'zod';

export const runRetentionSchema = z.object({
  applicationId: z.string().min(1),
  interval: z.enum(['daily', 'weekly']),
  cohortWindow: z.object({
    value: z.number().int().min(1).max(14),
    unit: z.enum(['days', 'weeks']),
  }),
  returnEventName: z.string().min(1).max(255).optional(),
});
