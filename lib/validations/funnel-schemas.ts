import { z } from 'zod';

export const funnelStepSchema = z.object({
  eventName: z.string().min(1).max(255),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const createFunnelSchema = z.object({
  applicationId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  steps: z.array(funnelStepSchema).min(2).max(10),
});

export const updateFunnelSchema = createFunnelSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided' },
);

export const listFunnelsSchema = z.object({
  applicationId: z.string().min(1).optional(),
  q: z.string().trim().max(120).optional(),
});

export const runFunnelSchema = z.object({
  applicationId: z.string().min(1).optional(),
  timeWindow: z.object({
    value: z.number().int().min(1).max(90),
    unit: z.enum(['days', 'weeks']),
  }),
});
