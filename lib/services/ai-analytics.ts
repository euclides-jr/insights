import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  queryDefinitionSchema,
  type QueryDefinition,
  stringPropertyFilterOperatorSchema,
  numberPropertyFilterOperatorSchema,
  booleanPropertyFilterOperatorSchema,
  timeBucketSchema,
  queryAggregationSchema,
} from "@/lib/validations/query-schemas";

export interface EventPropertyDefinition {
  type: "string" | "number" | "boolean" | "unknown";
  required?: boolean;
  description?: string;
}

export interface EventSchemaEntry {
  eventName: string;
  properties: Record<string, EventPropertyDefinition>;
}

export interface EventSchemaContext {
  applicationId: string;
  schemas: EventSchemaEntry[];
}

export interface GenerateQueryParams {
  question: string;
  applicationId: string;
  startDate: string;
  endDate: string;
  schemaContext: EventSchemaContext;
}

export interface ExplainResultsParams {
  question: string;
  query: QueryDefinition;
  results: Record<string, unknown>[];
  totalCount: number;
}

export interface AIAnalyticsHistoryEntry {
  id: string;
  timestamp: Date;
  question: string;
  query: QueryDefinition;
  results: Record<string, unknown>[];
  totalCount: number;
  explanation: string;
}

const MAX_SCHEMAS = 20;
const MAX_PROPERTIES_PER_SCHEMA = 30;
const MAX_DESCRIPTION_LENGTH = 200;

// The OpenAI Responses structured output validator requires every object
// property to be listed in `required`. For AI generation we therefore use a
// schema where optional fields are represented as nullable required fields, then
// normalize the result back into the app's existing QueryDefinition shape.
const aiStringPropertyFilterSchema = z.object({
  key: z.string().min(1),
  valueType: z.literal("string"),
  operator: stringPropertyFilterOperatorSchema,
  logic: z.enum(["and", "or"]).nullable(),
  value: z.union([z.string(), z.array(z.string()), z.null()]),
  secondValue: z.null(),
});

const aiNumberPropertyFilterSchema = z.object({
  key: z.string().min(1),
  valueType: z.literal("number"),
  operator: numberPropertyFilterOperatorSchema,
  logic: z.enum(["and", "or"]).nullable(),
  value: z.union([z.number(), z.array(z.number()), z.null()]),
  secondValue: z.number().nullable(),
});

const aiBooleanPropertyFilterSchema = z.object({
  key: z.string().min(1),
  valueType: z.literal("boolean"),
  operator: booleanPropertyFilterOperatorSchema,
  logic: z.enum(["and", "or"]).nullable(),
  value: z.boolean().nullable(),
  secondValue: z.null(),
});

const aiPropertyFilterSchema = z.discriminatedUnion("valueType", [
  aiStringPropertyFilterSchema,
  aiNumberPropertyFilterSchema,
  aiBooleanPropertyFilterSchema,
]);

const aiGroupBySchema = z
  .union([
    z.object({
      kind: z.literal("property"),
      key: z.string().min(1),
      bucket: z.null(),
    }),
    z.object({
      kind: z.literal("time"),
      key: z.null(),
      bucket: timeBucketSchema,
    }),
  ])
  .nullable();

const aiSortSchema = z
  .object({
    field: z.enum(["group", "value"]),
    direction: z.enum(["asc", "desc"]),
  })
  .nullable();

const aiQueryDefinitionSchema = z.object({
  applicationId: z.string().min(1),
  eventName: z.string().min(1).nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  propertyFilters: z.array(aiPropertyFilterSchema).nullable(),
  aggregation: queryAggregationSchema,
  aggregationField: z.string().min(1).nullable(),
  groupBy: aiGroupBySchema,
  sort: aiSortSchema,
  page: z.number().int().min(1).nullable(),
  pageSize: z.number().int().min(1).max(1000).nullable(),
  limit: z.number().int().min(1).max(10000).nullable(),
});

type AIGeneratedQuery = z.infer<typeof aiQueryDefinitionSchema>;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "between",
  "break",
  "broken",
  "by",
  "down",
  "for",
  "from",
  "happened",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "last",
  "many",
  "of",
  "on",
  "or",
  "since",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "this",
  "to",
  "total",
  "totals",
  "week",
  "what",
  "which",
  "with",
]);

const GROUP_BY_PATTERNS = [
  /broken down by\s+([a-z0-9_\s-]+)/i,
  /grouped by\s+([a-z0-9_\s-]+)/i,
  /split by\s+([a-z0-9_\s-]+)/i,
  /by\s+([a-z0-9_\s-]+)/i,
];

function normalizeAIQuery(query: AIGeneratedQuery): QueryDefinition {
  return queryDefinitionSchema.parse({
    applicationId: query.applicationId,
    eventName: query.eventName ?? undefined,
    startDate: query.startDate,
    endDate: query.endDate,
    propertyFilters:
      query.propertyFilters?.map((filter) => ({
        key: filter.key,
        valueType: filter.valueType,
        operator: filter.operator,
        logic: filter.logic ?? undefined,
        value: filter.value === null ? undefined : filter.value,
        secondValue:
          "secondValue" in filter && filter.secondValue !== null
            ? filter.secondValue
            : undefined,
      })) ?? undefined,
    aggregation: query.aggregation,
    aggregationField: query.aggregationField ?? undefined,
    groupBy:
      query.groupBy == null
        ? undefined
        : query.groupBy.kind === "property"
          ? { kind: "property", key: query.groupBy.key }
          : { kind: "time", bucket: query.groupBy.bucket },
    sort: query.sort ?? undefined,
    page: query.page ?? undefined,
    pageSize: query.pageSize ?? undefined,
    limit: query.limit ?? undefined,
  });
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .toLowerCase()
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreTokenOverlap(
  target: string,
  questionTokens: Set<string>,
): number {
  return tokenizeSearchText(target).reduce(
    (score, token) => score + (questionTokens.has(token) ? 1 : 0),
    0,
  );
}

function findBestSchemaMatch(
  question: string,
  schemaContext: EventSchemaContext,
  query: QueryDefinition,
): EventSchemaEntry | null {
  if (schemaContext.schemas.length === 0) {
    return null;
  }

  const questionTokens = new Set(tokenizeSearchText(question));
  const requestedGroupKey =
    query.groupBy?.kind === "property" ? query.groupBy.key : undefined;

  let bestSchema: EventSchemaEntry | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const schema of schemaContext.schemas) {
    let score = 0;
    score += scoreTokenOverlap(schema.eventName, questionTokens) * 8;

    for (const [propertyKey, definition] of Object.entries(schema.properties)) {
      score += scoreTokenOverlap(propertyKey, questionTokens) * 3;
      if (definition.description) {
        score += scoreTokenOverlap(definition.description, questionTokens);
      }
    }

    if (query.eventName === schema.eventName) {
      score += 2;
    }

    if (requestedGroupKey && requestedGroupKey in schema.properties) {
      score += 4;
    }

    if (query.aggregationField && query.aggregationField in schema.properties) {
      score += 3;
    }

    for (const filter of query.propertyFilters ?? []) {
      if (filter.key in schema.properties) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSchema = schema;
    }
  }

  return bestSchema;
}

function extractGroupingPhrase(question: string): string | null {
  for (const pattern of GROUP_BY_PATTERNS) {
    const match = question.match(pattern);
    if (!match) {
      continue;
    }

    const candidate = match[1]
      .split(/(?:,|\.|;|\?| and | with | where | since | over | during )/i)[0]
      ?.trim();

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function inferGroupByProperty(
  question: string,
  schema: EventSchemaEntry,
): string | undefined {
  const groupingPhrase = extractGroupingPhrase(question);
  const questionTokens = new Set(
    tokenizeSearchText(
      groupingPhrase ? `${groupingPhrase} ${question}` : question,
    ),
  );

  if (questionTokens.size === 0) {
    return undefined;
  }

  let bestKey: string | undefined;
  let bestScore = 0;

  for (const [propertyKey, definition] of Object.entries(schema.properties)) {
    const propertyScore =
      scoreTokenOverlap(propertyKey, questionTokens) * 10 +
      (definition.description
        ? scoreTokenOverlap(definition.description, questionTokens) * 2
        : 0);

    if (propertyScore > bestScore) {
      bestScore = propertyScore;
      bestKey = propertyKey;
    }
  }

  return bestScore > 0 ? bestKey : undefined;
}

function refineGeneratedQueryWithSchemaContext(
  question: string,
  query: QueryDefinition,
  schemaContext: EventSchemaContext,
): QueryDefinition {
  const selectedSchema =
    findBestSchemaMatch(question, schemaContext, query) ??
    (query.eventName
      ? (schemaContext.schemas.find(
          (schema) => schema.eventName === query.eventName,
        ) ?? null)
      : null);

  if (!selectedSchema) {
    return query;
  }

  const knownProperties = new Set(Object.keys(selectedSchema.properties));

  const propertyFilters = query.propertyFilters?.filter((filter) =>
    knownProperties.has(filter.key),
  );

  const groupByProperty =
    query.groupBy?.kind === "property" && knownProperties.has(query.groupBy.key)
      ? query.groupBy.key
      : inferGroupByProperty(question, selectedSchema);

  return queryDefinitionSchema.parse({
    ...query,
    eventName: selectedSchema.eventName,
    propertyFilters:
      propertyFilters && propertyFilters.length > 0
        ? propertyFilters
        : undefined,
    aggregationField:
      query.aggregationField && knownProperties.has(query.aggregationField)
        ? query.aggregationField
        : undefined,
    groupBy: groupByProperty
      ? { kind: "property", key: groupByProperty }
      : query.groupBy?.kind === "time"
        ? query.groupBy
        : undefined,
  });
}

function formatSchemaContext(context: EventSchemaContext): string {
  if (context.schemas.length === 0) {
    return "No event schemas available.";
  }

  const limitedSchemas = context.schemas.slice(0, MAX_SCHEMAS);

  const schemaTexts = limitedSchemas.map((schema) => {
    const allPropsEntries = Object.entries(schema.properties);
    const limitedPropsEntries = allPropsEntries.slice(
      0,
      MAX_PROPERTIES_PER_SCHEMA,
    );

    const props = limitedPropsEntries
      .map(([key, def]) => {
        const required = def.required ? " (required)" : "";
        let description = "";
        if (def.description) {
          const raw = def.description;
          const truncated =
            raw.length > MAX_DESCRIPTION_LENGTH
              ? raw.slice(0, MAX_DESCRIPTION_LENGTH) + "…"
              : raw;
          description = ` — ${truncated}`;
        }
        return `    - ${key}: ${def.type}${required}${description}`;
      })
      .join("\n");

    let schemaText = `Event: ${schema.eventName}\n  Properties:\n${props || "    (none)"}`;
    if (allPropsEntries.length > limitedPropsEntries.length) {
      const omitted = allPropsEntries.length - limitedPropsEntries.length;
      schemaText += `\n    ... (${omitted} more properties omitted)`;
    }
    return schemaText;
  });

  let result = schemaTexts.join("\n\n");
  if (context.schemas.length > limitedSchemas.length) {
    const omitted = context.schemas.length - limitedSchemas.length;
    result += `\n\n... (${omitted} more events omitted)`;
  }
  return result;
}

function buildGeneratePrompt(params: GenerateQueryParams): string {
  const schemaText = formatSchemaContext(params.schemaContext);

  return `You are an analytics query assistant. Your job is to translate a user's plain-language analytics question into a structured query definition.

IMPORTANT CONSTRAINTS:
- You MUST only use event names listed in the schema context below.
- You MUST only reference property keys that exist for the chosen event.
- You MUST choose the event whose name and properties best match the user's question.
- If the user asks for a breakdown, split, grouping, or "by X", you MUST set groupBy using the matching property on the chosen event when that property exists.
- The applicationId MUST be exactly: ${params.applicationId}
- startDate MUST be: ${params.startDate}
- endDate MUST be: ${params.endDate}
- Do NOT invent event names or property keys.

Available event schemas:
${schemaText}

If the question cannot be answered with the available schemas, still produce a best-effort query using the most relevant event. Set eventName to the most relevant event and omit propertyFilters if the required property does not exist.

User question: ${params.question}`;
}

const EXPLANATION_SYSTEM_PROMPT = `You are an analytics results interpreter. Given a user's analytics question, the query that was run to answer it, and the results, write a short plain-language explanation.

Rules:
- Be concise: 2–4 sentences for small result sets; up to 6 for time-series data.
- Address the user's question directly — did the results answer it?
- If results is empty, explain why no data was found and offer 1–2 possible reasons.
- If results include time-bucketed data, describe any notable trend.
- Do not mention technical details like SQL, database, API, or internal system names.
- Do not suggest schema changes or event tracking setup unless results are empty.`;

function buildExplainUserMessage(params: ExplainResultsParams): string {
  const querySummary = [
    `Event: ${params.query.eventName ?? "(all events)"}`,
    `Aggregation: ${params.query.aggregation}`,
    params.query.aggregationField
      ? `Field: ${params.query.aggregationField}`
      : null,
    params.query.groupBy
      ? `Group by: ${params.query.groupBy.kind === "property" ? params.query.groupBy.key : `time (${params.query.groupBy.bucket})`}`
      : null,
    `Date range: ${params.query.startDate} to ${params.query.endDate}`,
  ]
    .filter(Boolean)
    .join(", ");

  const truncatedResults = params.results.slice(0, 20);

  return `User question: ${params.question}
Query executed: ${querySummary}
Result count: ${params.totalCount}
Results: ${JSON.stringify(truncatedResults)}`;
}

export async function buildEventSchemaContext(
  applicationId: string,
): Promise<EventSchemaContext> {
  const rows = await prisma.eventSchema.findMany({
    where: { applicationId, isActive: true },
  });

  const schemas: EventSchemaEntry[] = rows.map(
    (row: { eventName: string; schemaDefinition: unknown }) => {
      const schemaDef = row.schemaDefinition as {
        properties?: Record<
          string,
          { type?: string; required?: boolean; description?: string }
        >;
      };

      const properties: Record<string, EventPropertyDefinition> = {};
      for (const [key, def] of Object.entries(schemaDef.properties ?? {})) {
        const rawType = def.type ?? "unknown";
        const normalizedType: EventPropertyDefinition["type"] =
          rawType === "string" || rawType === "number" || rawType === "boolean"
            ? rawType
            : "unknown";

        properties[key] = {
          type: normalizedType,
          required: def.required,
          description: def.description,
        };
      }

      return { eventName: row.eventName, properties };
    },
  );

  return { applicationId, schemas };
}

export async function generateQueryFromPrompt(
  params: GenerateQueryParams,
): Promise<QueryDefinition> {
  const { object } = await generateObject({
    model: openai(process.env.AI_MODEL ?? "gpt-4o-mini"),
    schema: aiQueryDefinitionSchema,
    prompt: buildGeneratePrompt(params),
  });

  return refineGeneratedQueryWithSchemaContext(
    params.question,
    normalizeAIQuery(object),
    params.schemaContext,
  );
}

export async function explainQueryResults(
  params: ExplainResultsParams,
): Promise<string> {
  const { text } = await generateText({
    model: openai(process.env.AI_MODEL ?? "gpt-4o-mini"),
    messages: [
      { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
      { role: "user", content: buildExplainUserMessage(params) },
    ],
    maxOutputTokens: 300, // ~225 words; keeps explanations concise
  });

  return text;
}

export { NoObjectGeneratedError };
