'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';

interface Application {
  id: string;
  name: string;
}

interface EventFilter {
  id: string;
  eventName: string;
  countMin: string;
  countMax: string;
  timeWindowValue: string;
  timeWindowUnit: 'days' | 'hours';
  useTimeWindow: boolean;
}

interface SegmentFormProps {
  applications: Application[];
  segmentId?: string;
  defaultApplicationId?: string;
  defaultName?: string;
  defaultDescription?: string;
  defaultFilters?: EventFilter[];
  defaultLogic?: 'AND' | 'OR';
  onSuccess?: () => void;
  isEditMode?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyFilter(): EventFilter {
  return {
    id: uid(),
    eventName: '',
    countMin: '',
    countMax: '',
    timeWindowValue: '',
    timeWindowUnit: 'days',
    useTimeWindow: false,
  };
}

export function SegmentForm({
  applications,
  segmentId,
  defaultApplicationId,
  defaultName = '',
  defaultDescription = '',
  defaultFilters,
  defaultLogic = 'AND',
  onSuccess,
  isEditMode = false,
}: SegmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [applicationId, setApplicationId] = useState(
    defaultApplicationId ?? applications[0]?.id ?? '',
  );
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [logic, setLogic] = useState<'AND' | 'OR'>(defaultLogic);
  const [filters, setFilters] = useState<EventFilter[]>(
    defaultFilters ?? [emptyFilter()],
  );
  const [error, setError] = useState<string | null>(null);

  // ─── Filter row helpers ──────────────────────────────────────────────────

  function addFilter() {
    setFilters((prev) => [...prev, emptyFilter()]);
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFilter(id: string, patch: Partial<EventFilter>) {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  // ─── Build criteria payload ──────────────────────────────────────────────

  function buildCriteria() {
    return {
      logic,
      eventFilters: filters.map((f) => {
        const filter: Record<string, unknown> = {
          eventName: f.eventName,
        };

        const hasMin = f.countMin !== '';
        const hasMax = f.countMax !== '';
        if (hasMin || hasMax) {
          filter.count = {
            ...(hasMin ? { min: parseInt(f.countMin, 10) } : {}),
            ...(hasMax ? { max: parseInt(f.countMax, 10) } : {}),
          };
        }

        if (f.useTimeWindow && f.timeWindowValue !== '') {
          filter.timeWindow = {
            value: parseInt(f.timeWindowValue, 10),
            unit: f.timeWindowUnit,
          };
        }

        return filter;
      }),
    };
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Segment name is required');
      return;
    }

    if (filters.some((f) => !f.eventName.trim())) {
      setError('All event filters must have an event name');
      return;
    }

    startTransition(async () => {
      try {
        const url = isEditMode
          ? `/api/segments/${segmentId}`
          : '/api/segments';
        const method = isEditMode ? 'PUT' : 'POST';

        const payload = isEditMode
          ? { name, description, criteria: buildCriteria() }
          : {
              applicationId,
              name,
              description: description || undefined,
              criteria: buildCriteria(),
            };

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(
            data.error ??
              (data.details
                ? data.details.map((d: { message: string }) => d.message).join(', ')
                : 'Save failed'),
          );
          return;
        }

        router.refresh();
        onSuccess?.();
      } catch {
        setError('Network error — please try again');
      }
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const labelClass = 'block text-xs font-medium text-[#7A7A7A] mb-1';
  const compactSelectClass = `${selectInputClass} h-8 rounded-none px-2.5 py-1 pr-9 focus:ring-0`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Application picker (create only) */}
      {!isEditMode && (
        <div>
          <label className={labelClass}>Application</label>
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className={compactSelectClass}
            style={selectChevronStyle}
          >
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Name */}
      <div>
        <label className={labelClass}>Segment Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Power users (last 30 days)"
          className="h-8"
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description (optional)</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe who belongs in this segment"
          className="h-8"
        />
      </div>

      {/* Logic toggle */}
      <div>
        <label className={labelClass}>Filter logic</label>
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLogic(opt)}
              className={`px-3 h-8 text-sm font-medium border transition-colors ${
                logic === opt
                  ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]'
                  : 'bg-white text-[#0D0D0D] border-[#E8E8E8] hover:border-[#0D0D0D]'
              }`}
            >
              {opt}
            </button>
          ))}
          <span className="text-xs text-[#7A7A7A] self-center ml-2">
            {logic === 'AND'
              ? 'User must match ALL filters'
              : 'User must match ANY filter'}
          </span>
        </div>
      </div>

      {/* Event filters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`${labelClass} mb-0`}>Event Filters</label>
          <button
            type="button"
            onClick={addFilter}
            className="text-xs text-[#E42313] hover:underline"
          >
            + Add filter
          </button>
        </div>

        <div className="space-y-4">
          {filters.map((filter, idx) => (
            <div
              key={filter.id}
              className="border border-[#E8E8E8] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7A7A7A]">
                  Filter {idx + 1}
                </span>
                {filters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFilter(filter.id)}
                    className="text-xs text-[#7A7A7A] hover:text-[#E42313]"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Event name */}
              <div>
                <label className={labelClass}>Event Name</label>
                <Input
                  value={filter.eventName}
                  onChange={(e) =>
                    updateFilter(filter.id, { eventName: e.target.value })
                  }
                  placeholder="e.g. page_view"
                  className="h-8"
                />
              </div>

              {/* Count range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Min occurrences</label>
                  <Input
                    type="number"
                    min={0}
                    value={filter.countMin}
                    onChange={(e) =>
                      updateFilter(filter.id, { countMin: e.target.value })
                    }
                    placeholder="e.g. 3"
                    className="h-8"
                  />
                </div>
                <div>
                  <label className={labelClass}>Max occurrences</label>
                  <Input
                    type="number"
                    min={0}
                    value={filter.countMax}
                    onChange={(e) =>
                      updateFilter(filter.id, { countMax: e.target.value })
                    }
                    placeholder="optional"
                    className="h-8"
                  />
                </div>
              </div>

              {/* Time window */}
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#7A7A7A] mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useTimeWindow}
                    onChange={(e) =>
                      updateFilter(filter.id, {
                        useTimeWindow: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5"
                  />
                  Restrict to time window
                </label>
                {filter.useTimeWindow && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      min={1}
                      value={filter.timeWindowValue}
                      onChange={(e) =>
                        updateFilter(filter.id, {
                          timeWindowValue: e.target.value,
                        })
                      }
                      placeholder="e.g. 30"
                      className="h-8 w-24"
                    />
                    <select
                      value={filter.timeWindowUnit}
                      onChange={(e) =>
                        updateFilter(filter.id, {
                          timeWindowUnit: e.target.value as 'days' | 'hours',
                        })
                      }
                      className={`${compactSelectClass} w-auto`}
                      style={selectChevronStyle}
                    >
                      <option value="days">days</option>
                      <option value="hours">hours</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-[#E42313] border border-[#E42313]/20 bg-[#E42313]/5 px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? 'Saving…'
            : isEditMode
              ? 'Save Changes'
              : 'Create Segment'}
        </Button>
      </div>
    </form>
  );
}
