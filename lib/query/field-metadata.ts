import { prisma } from '@/lib/db/prisma';

export type QueryFieldMetadata = {
  eventName: string;
  key: string;
  valueType: 'string' | 'number' | 'boolean' | 'unknown';
  required: boolean;
};

type EventSchemaDefinition = {
  properties?: Record<
    string,
    {
      type?: string;
      required?: boolean;
    }
  >;
};

function normalizeValueType(value?: string): QueryFieldMetadata['valueType'] {
  if (value === 'string' || value === 'number' || value === 'boolean') {
    return value;
  }

  return 'unknown';
}

export async function listQueryFieldMetadata(
  applicationId: string,
  eventName?: string,
): Promise<QueryFieldMetadata[]> {
  const schemas = await prisma.eventSchema.findMany({
    where: {
      applicationId,
      isActive: true,
      ...(eventName ? { eventName } : {}),
    },
    select: {
      eventName: true,
      schemaDefinition: true,
    },
    orderBy: [{ eventName: 'asc' }],
  });

  const fields = new Map<string, QueryFieldMetadata>();

  for (const schema of schemas) {
    const definition = schema.schemaDefinition as EventSchemaDefinition;
    const properties = definition.properties ?? {};

    for (const [key, property] of Object.entries(properties)) {
      const mapKey = `${schema.eventName}:${key}`;
      if (fields.has(mapKey)) {
        continue;
      }

      fields.set(mapKey, {
        eventName: schema.eventName,
        key,
        valueType: normalizeValueType(property.type),
        required: Boolean(property.required),
      });
    }
  }

  return Array.from(fields.values());
}
