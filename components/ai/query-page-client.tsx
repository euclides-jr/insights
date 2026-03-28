'use client';

import { useState } from 'react';
import { AIAnalyticsPanel } from '@/components/ai/ai-analytics-panel';
import { QueryForm } from '@/components/query-form';
import type { QueryDefinition } from '@/lib/validations/query-schemas';
import type { QueryFieldMetadata } from '@/lib/query/field-metadata';

interface Application {
  id: string;
  name: string;
}

interface QueryPageClientProps {
  applications: Application[];
  fieldMetadataByApplication: Record<string, QueryFieldMetadata[]>;
  initialState: Partial<QueryDefinition>;
}

export function QueryPageClient({
  applications,
  fieldMetadataByApplication,
  initialState: serverInitialState,
}: QueryPageClientProps) {
  const [queryFormKey, setQueryFormKey] = useState(0);
  const [queryInitialState, setQueryInitialState] =
    useState<Partial<QueryDefinition>>(serverInitialState);

  function handleLoadQueryIntoForm(query: QueryDefinition) {
    setQueryInitialState(query);
    setQueryFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-12">
      <AIAnalyticsPanel
        applications={applications}
        onLoadQueryIntoForm={handleLoadQueryIntoForm}
      />
      <QueryForm
        key={queryFormKey}
        applications={applications}
        fieldMetadataByApplication={fieldMetadataByApplication}
        initialState={queryInitialState}
      />
    </div>
  );
}
