import { generateObject, generateText, NoObjectGeneratedError } from 'ai';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@/lib/db/prisma';
import {
  queryDefinitionSchema,
  type QueryDefinition,
} from '@/lib/validations/query-schemas';

export interface EventPropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'unknown';
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

function formatSchemaContext(context: EventSchemaContext): string {
  if (context.schemas.length === 0) {
    return 'No event schemas available.';
  }

  const limitedSchemas = context.schemas.slice(0, MAX_SCHEMAS);

  const schemaTexts = limitedSchemas.map((schema) => {
    const allPropsEntries = Object.entries(schema.properties);
    const limitedPropsEntries = allPropsEntries.slice(0, MAX_PROPERTIES_PER_SCHEMA);

    const props = limitedPropsEntries
      .map(([key, def]) => {
        const required = def.required ? ' (required)' : '';
        let description = '';
        if (def.description) {
          const raw = def.description;
          const truncated =
            raw.length > MAX_DESCRIPTION_LENGTH
              ? raw.slice(0, MAX_DESCRIPTION_LENGTH) + '…'
              : raw;
          description = ` — ${truncated}`;
        }
        return `    - ${key}: ${def.type}${required}${description}`;
      })
      .join('\n');

    let schemaText = `Event: ${schema.eventName}\n  Properties:\n${props || '    (none)'}`;
    if (allPropsEntries.length > limitedPropsEntries.length) {
      const omitted = allPropsEntries.length - limitedPropsEntries.length;
      schemaText += `\n    ... (${omitted} more properties omitted)`;
    }
    return schemaText;
  });

  let result = schemaTexts.join('\n\n');
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
    `Event: ${params.query.eventName ?? '(all events)'}`,
    `Aggregation: ${params.query.aggregation}`,
    params.query.aggregationField
      ? `Field: ${params.query.aggregationField}`
      : null,
    params.query.groupBy
      ? `Group by: ${params.query.groupBy.kind === 'property' ? params.query.groupBy.key : `time (${params.query.groupBy.bucket})`}`
      : null,
    `Date range: ${params.query.startDate} to ${params.query.endDate}`,
  ]
    .filter(Boolean)
    .join(', ');

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

  const schemas: EventSchemaEntry[] = rows.map((row: {
    eventName: string;
    schemaDefinition: unknown;
  }) => {
    const schemaDef = row.schemaDefinition as {
      properties?: Record<
        string,
        { type?: string; required?: boolean; description?: string }
      >;
    };

    const properties: Record<string, EventPropertyDefinition> = {};
    for (const [key, def] of Object.entries(schemaDef.properties ?? {})) {
      const rawType = def.type ?? 'unknown';
      const normalizedType: EventPropertyDefinition['type'] =
        rawType === 'string' ||
        rawType === 'number' ||
        rawType === 'boolean'
          ? rawType
          : 'unknown';

      properties[key] = {
        type: normalizedType,
        required: def.required,
        description: def.description,
      };
    }

    return { eventName: row.eventName, properties };
  });

  return { applicationId, schemas };
}

export async function generateQueryFromPrompt(
  params: GenerateQueryParams,
): Promise<QueryDefinition> {
  const { object: query } = await generateObject({
    model: openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
    schema: queryDefinitionSchema,
    prompt: buildGeneratePrompt(params),
  });

  return query;
}

export async function explainQueryResults(
  params: ExplainResultsParams,
): Promise<string> {
  const { text } = await generateText({
    model: openai(process.env.AI_MODEL ?? 'gpt-4o-mini'),
    messages: [
      { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
      { role: 'user', content: buildExplainUserMessage(params) },
    ],
    maxOutputTokens: 300, // ~225 words; keeps explanations concise
  });

  return text;
}

export { NoObjectGeneratedError };
