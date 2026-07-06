import { z } from 'zod';

/** Reachability status of a single dependency. */
export const componentStatusSchema = z.enum(['ok', 'down']);

/** Schema mirroring the shared `HealthReport` contract (FR-011). */
export const healthReportSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  components: z.object({
    api: z.literal('ok'),
    database: componentStatusSchema,
    storage: componentStatusSchema,
  }),
  timestamp: z.string(),
});

export type HealthReportShape = z.infer<typeof healthReportSchema>;
