import { z } from 'zod';

export const queryAggregationSchema = z.enum([
  'count',
  'unique_users',
  'avg',
  'sum',
]);

export const queryValueTypeSchema = z.enum(['string', 'number', 'boolean']);

export const stringPropertyFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'exists',
  'not_exists',
]);

export const numberPropertyFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'not_in',
  'exists',
  'not_exists',
]);

export const booleanPropertyFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'exists',
  'not_exists',
]);

export const propertyFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'exists',
  'not_exists',
]);

const propertyFilterBaseSchema = z.object({
  id: z.string().min(1).optional(),
  key: z.string().min(1, 'Filter key is required'),
  logic: z.enum(['and', 'or']).optional(),
});

const stringPropertyFilterSchema = propertyFilterBaseSchema.extend({
  valueType: z.literal('string'),
  operator: stringPropertyFilterOperatorSchema,
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

const numberPropertyFilterSchema = propertyFilterBaseSchema.extend({
  valueType: z.literal('number'),
  operator: numberPropertyFilterOperatorSchema,
  value: z.union([z.number(), z.array(z.number())]).optional(),
  secondValue: z.number().optional(),
});

const booleanPropertyFilterSchema = propertyFilterBaseSchema.extend({
  valueType: z.literal('boolean'),
  operator: booleanPropertyFilterOperatorSchema,
  value: z.boolean().optional(),
});

export const propertyFilterSchema = z
  .union([
    stringPropertyFilterSchema,
    numberPropertyFilterSchema,
    booleanPropertyFilterSchema,
  ])
  .superRefine((filter, ctx) => {
    if (
      (filter.operator === 'exists' || filter.operator === 'not_exists') &&
      filter.value !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${filter.operator} filters must not include a value`,
      });
    }

    if (
      filter.valueType === 'string' &&
      (filter.operator === 'in' || filter.operator === 'not_in') &&
      !Array.isArray(filter.value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${filter.operator} requires an array of string values`,
      });
    }

    if (
      filter.valueType === 'number' &&
      filter.operator === 'between' &&
      (typeof filter.value !== 'number' || typeof filter.secondValue !== 'number')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'between requires numeric value and secondValue',
      });
    }

    if (
      filter.valueType === 'number' &&
      (filter.operator === 'in' || filter.operator === 'not_in') &&
      !Array.isArray(filter.value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${filter.operator} requires an array of numeric values`,
      });
    }

    if (
      filter.operator !== 'exists' &&
      filter.operator !== 'not_exists' &&
      filter.operator !== 'between' &&
      filter.value === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `Value is required for ${filter.operator} filters`,
      });
    }
  });

export const timeBucketSchema = z.enum(['hour', 'day', 'week', 'month']);

export const groupByDefinitionSchema = z.union([
  z.object({
    kind: z.literal('property'),
    key: z.string().min(1, 'Property group key is required'),
  }),
  z.object({
    kind: z.literal('time'),
    bucket: timeBucketSchema,
  }),
]);

export const querySortSchema = z.object({
  field: z.enum(['group', 'value']),
  direction: z.enum(['asc', 'desc']),
});

const legacyFiltersSchema = z
  .record(z.union([z.string(), z.number(), z.boolean()]))
  .optional();

const rawQueryRequestSchema = z.object({
  applicationId: z.string().min(1, 'applicationId is required'),
  eventName: z.string().min(1).optional(),
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
  filters: legacyFiltersSchema,
  propertyFilters: z.array(propertyFilterSchema).optional(),
  aggregation: queryAggregationSchema.default('count'),
  aggregationField: z.string().min(1).optional(),
  groupBy: z.union([z.string().min(1), groupByDefinitionSchema]).optional(),
  sort: querySortSchema.optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
});

const queryDefinitionBaseSchema = z.object({
  applicationId: z.string().min(1, 'applicationId is required'),
  eventName: z.string().min(1).optional(),
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
  propertyFilters: z.array(propertyFilterSchema).optional(),
  aggregation: queryAggregationSchema.default('count'),
  aggregationField: z.string().min(1).optional(),
  groupBy: groupByDefinitionSchema.optional(),
  sort: querySortSchema.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

export const queryDefinitionSchema = queryDefinitionBaseSchema.superRefine(
  (query, ctx) => {
    if (
      (query.aggregation === 'avg' || query.aggregation === 'sum') &&
      !query.aggregationField
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aggregationField'],
        message: `${query.aggregation} requires aggregationField`,
      });
    }
  },
);

export type PropertyFilter = z.infer<typeof propertyFilterSchema>;
export type GroupByDefinition = z.infer<typeof groupByDefinitionSchema>;
export type QuerySort = z.infer<typeof querySortSchema>;
export type QueryDefinition = z.infer<typeof queryDefinitionSchema>;

export function legacyFiltersToPropertyFilters(
  filters?: Record<string, string | number | boolean>,
): PropertyFilter[] | undefined {
  if (!filters || Object.keys(filters).length === 0) {
    return undefined;
  }

  return Object.entries(filters).map<PropertyFilter>(([key, value], index) => {
    const logic = index > 0 ? { logic: 'and' as const } : {};

    if (typeof value === 'number') {
      return {
        key,
        valueType: 'number',
        operator: 'eq',
        value,
        ...logic,
      };
    }

    if (typeof value === 'boolean') {
      return {
        key,
        valueType: 'boolean',
        operator: 'eq',
        value,
        ...logic,
      };
    }

    return {
      key,
      valueType: 'string',
      operator: 'eq',
      value,
      ...logic,
    };
  });
}

export function normalizeQueryDefinition(
  input: z.input<typeof rawQueryRequestSchema>,
): QueryDefinition {
  const parsed = rawQueryRequestSchema.parse(input);

  return queryDefinitionSchema.parse({
    applicationId: parsed.applicationId,
    eventName: parsed.eventName,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    propertyFilters:
      parsed.propertyFilters ?? legacyFiltersToPropertyFilters(parsed.filters),
    aggregation: parsed.aggregation,
    aggregationField: parsed.aggregationField,
    groupBy:
      typeof parsed.groupBy === 'string'
        ? { kind: 'property', key: parsed.groupBy }
        : parsed.groupBy,
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.pageSize,
    limit: parsed.limit,
  });
}

export const queryHydrationSchema = queryDefinitionBaseSchema.partial();
