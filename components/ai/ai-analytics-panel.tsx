'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AIExplanation } from '@/components/ai/ai-explanation';
import { AIQueryInspector } from '@/components/ai/ai-query-inspector';
import { selectInputClass, selectChevronStyle } from '@/components/ui/select';
import { getAIErrorMessage } from '@/lib/ai-error-messages';
import type { QueryDefinition } from '@/lib/validations/query-schemas';
import type { AIAnalyticsHistoryEntry } from '@/lib/services/ai-analytics';

interface Application {
  id: string;
  name: string;
}

interface QueryResult {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
}

type PanelState =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'executing'; query: QueryDefinition }
  | { status: 'explaining'; query: QueryDefinition; results: QueryResult }
  | {
      status: 'done';
      query: QueryDefinition;
      results: QueryResult;
      explanation: string;
    }
  | { status: 'error'; message: string };

interface AIAnalyticsPanelProps {
  applications: Application[];
  onLoadQueryIntoForm: (query: QueryDefinition) => void;
}

const STATE_LABELS: Record<string, string> = {
  generating: 'Generating query…',
  executing: 'Running query…',
  explaining: 'Explaining results…',
};

export function AIAnalyticsPanel({
  applications,
  onLoadQueryIntoForm,
}: AIAnalyticsPanelProps) {
  const [applicationId, setApplicationId] = useState(
    applications[0]?.id ?? '',
  );
  const [question, setQuestion] = useState('');
  const [panelState, setPanelState] = useState<PanelState>({ status: 'idle' });
  const [history, setHistory] = useState<AIAnalyticsHistoryEntry[]>([]);

  const isSubmitDisabled =
    !applicationId ||
    question.trim().length === 0 ||
    panelState.status !== 'idle';

  async function handleSubmit() {
    if (isSubmitDisabled) return;

    const app = applications.find((a) => a.id === applicationId);
    if (!app) return;

    const selectedApplicationId = applicationId;
    const submittedQuestion = question.trim();
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = now.toISOString();

    setPanelState({ status: 'generating' });

    let query: QueryDefinition;
    try {
      const generateRes = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: submittedQuestion,
          applicationId: selectedApplicationId,
          startDate,
          endDate,
        }),
      });

      const generateData: {
        query?: QueryDefinition;
        error?: string;
        message?: string;
      } = await generateRes.json();

      if (!generateRes.ok) {
        const errorCode = generateData.error;
        setPanelState({
          status: 'error',
          message: getAIErrorMessage(errorCode),
        });
        return;
      }

      query = generateData.query!;
    } catch {
      setPanelState({
        status: 'error',
        message: getAIErrorMessage('internal_error'),
      });
      return;
    }

    setPanelState({ status: 'executing', query });

    let queryResult: QueryResult;
    try {
      const queryRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!queryRes.ok) {
        const data: { error?: string } = await queryRes.json();
        setPanelState({
          status: 'error',
          message: data.error ?? getAIErrorMessage('internal_error'),
        });
        return;
      }

      queryResult = await queryRes.json();
    } catch {
      setPanelState({
        status: 'error',
        message: getAIErrorMessage('internal_error'),
      });
      return;
    }

    setPanelState({ status: 'explaining', query, results: queryResult });

    let explanation = '';
    try {
      const explainResults = Array.isArray(queryResult.results)
        ? queryResult.results.slice(0, 20)
        : queryResult.results;

      const explainRes = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: submittedQuestion,
          query,
          results: explainResults,
          totalCount: queryResult.totalCount,
        }),
      });

      if (explainRes.ok) {
        const explainData: { explanation?: string } = await explainRes.json();
        explanation = explainData.explanation ?? '';
      }
    } catch {
      // Explanation failure is non-fatal; results remain visible
    }

    const entry: AIAnalyticsHistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: now,
      question: submittedQuestion,
      query,
      results: queryResult.results,
      totalCount: queryResult.totalCount,
      explanation,
    };

    setHistory((prev) => [entry, ...prev].slice(0, 20));
    setPanelState({ status: 'done', query, results: queryResult, explanation });
  }

  function handleDismissError() {
    setPanelState({ status: 'idle' });
  }

  function restoreHistoryEntry(entry: AIAnalyticsHistoryEntry) {
    setApplicationId(entry.query.applicationId);
    setQuestion(entry.question);
    setPanelState({
      status: 'done',
      query: entry.query,
      results: {
        results: entry.results,
        totalCount: entry.totalCount,
        executionTimeMs: 0,
      },
      explanation: entry.explanation,
    });
  }

  const isLoading =
    panelState.status === 'generating' ||
    panelState.status === 'executing' ||
    panelState.status === 'explaining';

  const loadingLabel =
    isLoading ? STATE_LABELS[panelState.status] ?? '' : null;

  return (
    <div className="space-y-6">
      {/* Input area */}
      <div className="border border-[#E8E8E8] bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold font-(family-name:--font-space-grotesk) tracking-tight mb-1">
            AI Analytics
          </h2>
          <p className="text-sm text-[#7A7A7A]">
            Ask a question in plain language and get query results with an
            explanation.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#0A0A0A] mb-1.5">
              Application
            </label>
            <div className="relative">
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className={selectInputClass}
                style={selectChevronStyle}
                disabled={isLoading}
              >
                {applications.length === 0 && (
                  <option value="">No applications available</option>
                )}
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#0A0A0A]">
                Question
              </label>
              <span className="text-xs text-[#7A7A7A]">
                {question.length}/500
              </span>
            </div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How many signups happened last week, broken down by plan?"
              maxLength={500}
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              {isLoading ? loadingLabel : 'Generate Query'}
            </Button>

            {isLoading && (
              <span className="text-sm text-[#7A7A7A] animate-pulse">
                {loadingLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {panelState.status === 'error' && (
        <div className="border border-red-200 bg-red-50 px-6 py-4 flex items-start justify-between gap-4">
          <p className="text-sm text-red-700">{panelState.message}</p>
          <button
            onClick={handleDismissError}
            className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Done state: results + explanation + query inspector */}
      {panelState.status === 'done' && (
        <div className="space-y-4">
          {/* Results summary */}
          <div className="border border-[#E8E8E8] bg-white px-6 py-4">
            <p className="text-sm font-medium text-[#0D0D0D] mb-3">
              Results
              <span className="ml-2 text-xs font-normal text-[#7A7A7A]">
                {panelState.results.totalCount} row
                {panelState.results.totalCount !== 1 ? 's' : ''}
              </span>
            </p>
            {panelState.results.results.length === 0 ? (
              <p className="text-sm text-[#7A7A7A]">No results found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E8E8]">
                      {Object.keys(panelState.results.results[0] ?? {}).map(
                        (col) => (
                          <th
                            key={col}
                            className="text-left py-2 pr-6 text-xs font-medium text-[#7A7A7A] uppercase tracking-wide"
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {panelState.results.results.slice(0, 50).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#E8E8E8] last:border-0"
                      >
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 pr-6 text-[#0D0D0D]">
                            {String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <AIExplanation explanation={panelState.explanation || null} />

          <AIQueryInspector
            query={panelState.query}
            onOpenInExplorer={onLoadQueryIntoForm}
          />
        </div>
      )}

      {/* Session history */}
      {history.length > 0 && (
        <div className="border border-[#E8E8E8] bg-white">
          <div className="px-6 py-3 border-b border-[#E8E8E8]">
            <p className="text-sm font-medium text-[#0D0D0D]">
              Session History
            </p>
          </div>
          <ul className="divide-y divide-[#E8E8E8]">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => restoreHistoryEntry(entry)}
                  className="w-full text-left px-6 py-3 hover:bg-[#FAFAFA] transition-colors"
                >
                  <p className="text-sm text-[#0D0D0D] line-clamp-1">
                    {entry.question}
                  </p>
                  <p className="text-xs text-[#7A7A7A] mt-0.5">
                    {entry.timestamp.toLocaleTimeString()} ·{' '}
                    {entry.totalCount} row
                    {entry.totalCount !== 1 ? 's' : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
