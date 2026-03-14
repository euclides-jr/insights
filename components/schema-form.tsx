'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface PropertyRow {
  id: string;
  key: string;
  type: PropertyType;
  required: boolean;
  description: string;
}

interface Application {
  id: string;
  name: string;
}

interface SchemaFormProps {
  /** Available applications for the picker. */
  applications: Application[];
  /** If provided, we're editing an existing schema (PUT). */
  schemaId?: string;
  /** Pre-fill fields when editing. */
  defaultApplicationId?: string;
  defaultEventName?: string;
  defaultProperties?: PropertyRow[];
  /** Called after a successful save so the parent can close a dialog. */
  onSuccess?: () => void;
  isEditMode?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function SchemaForm({
  applications,
  schemaId,
  defaultApplicationId,
  defaultEventName = '',
  defaultProperties,
  onSuccess,
  isEditMode = false,
}: SchemaFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [applicationId, setApplicationId] = useState(
    defaultApplicationId ?? applications[0]?.id ?? '',
  );
  const [eventName, setEventName] = useState(defaultEventName);
  const [properties, setProperties] = useState<PropertyRow[]>(
    defaultProperties ?? [
      { id: uid(), key: '', type: 'string', required: false, description: '' },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ─── Property row helpers ────────────────────────────────────────────────

  function addProperty() {
    setProperties((prev) => [
      ...prev,
      { id: uid(), key: '', type: 'string', required: false, description: '' },
    ]);
  }

  function removeProperty(id: string) {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  function updateProperty(id: string, patch: Partial<PropertyRow>) {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  // ─── Submission ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!applicationId) errors.applicationId = 'Required';
    if (!eventName.trim()) errors.eventName = 'Required';
    if (!/^[a-zA-Z0-9_]+$/.test(eventName))
      errors.eventName = 'Only letters, numbers and underscores allowed';

    const filled = properties.filter((p) => p.key.trim());
    if (filled.length === 0) errors.properties = 'Add at least one property';

    const keys = filled.map((p) => p.key.trim());
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0)
      errors.properties = `Duplicate property keys: ${[...new Set(dupes)].join(', ')}`;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Build properties map
    const propertiesMap = Object.fromEntries(
      filled.map(({ key, type, required, description }) => [
        key.trim(),
        {
          type,
          required,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      ]),
    );

    const url =
      isEditMode && schemaId ? `/api/schemas/${schemaId}` : '/api/schemas';
    const method = isEditMode ? 'PUT' : 'POST';
    const bodyPayload = isEditMode
      ? { properties: propertiesMap }
      : {
          applicationId,
          eventName: eventName.trim(),
          properties: propertiesMap,
        };

    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Save failed');
          return;
        }

        onSuccess?.();
        router.refresh();
        if (!isEditMode) {
          router.push(`/schemas/${data.id}`);
        }
      } catch {
        setError('Network error — please try again');
      }
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Application + Event Name ----------------------------------------- */}
      {!isEditMode && (
        <div className="grid grid-cols-2 gap-4">
          {/* Application */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Application
            </label>
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className="w-full h-10 px-3 border border-[#E8E8E8] bg-white text-sm focus:outline-none focus:border-[#0D0D0D] transition-colors"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            {fieldErrors.applicationId && (
              <p className="text-xs text-red-500">
                {fieldErrors.applicationId}
              </p>
            )}
          </div>

          {/* Event Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Event Name
            </label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. purchase_completed"
            />
            {fieldErrors.eventName && (
              <p className="text-xs text-red-500">{fieldErrors.eventName}</p>
            )}
          </div>
        </div>
      )}

      {/* Properties ------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
            Properties
          </label>
          <button
            type="button"
            onClick={addProperty}
            className="text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors underline-offset-2 hover:underline"
          >
            + Add property
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_80px_1fr_32px] gap-2 text-xs text-[#7A7A7A] px-1">
          <span>Key</span>
          <span>Type</span>
          <span>Required</span>
          <span>Description</span>
          <span />
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {properties.map((prop) => (
            <div
              key={prop.id}
              className="grid grid-cols-[1fr_120px_80px_1fr_32px] gap-2 items-center"
            >
              {/* Key */}
              <Input
                value={prop.key}
                onChange={(e) =>
                  updateProperty(prop.id, { key: e.target.value })
                }
                placeholder="property_name"
                className="text-xs h-8"
              />

              {/* Type */}
              <select
                value={prop.type}
                onChange={(e) =>
                  updateProperty(prop.id, {
                    type: e.target.value as PropertyType,
                  })
                }
                className="w-full h-8 px-2 border border-[#E8E8E8] bg-white text-xs focus:outline-none focus:border-[#0D0D0D] transition-colors"
              >
                {(
                  ['string', 'number', 'boolean', 'object', 'array'] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Required */}
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={prop.required}
                  onChange={(e) =>
                    updateProperty(prop.id, { required: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#E42313]"
                />
              </div>

              {/* Description */}
              <Input
                value={prop.description}
                onChange={(e) =>
                  updateProperty(prop.id, { description: e.target.value })
                }
                placeholder="Optional description"
                className="text-xs h-8"
              />

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeProperty(prop.id)}
                disabled={properties.length === 1}
                className="w-8 h-8 flex items-center justify-center text-[#7A7A7A] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Remove property"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2L12 12M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {fieldErrors.properties && (
          <p className="text-xs text-red-500">{fieldErrors.properties}</p>
        )}
      </div>

      {/* Error banner ------------------------------------------------------ */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions ---------------------------------------------------------- */}
      <div className="flex justify-end gap-3 pt-2">
        {onSuccess && (
          <Button
            type="button"
            variant="secondary"
            onClick={onSuccess}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending
            ? 'Saving…'
            : isEditMode
              ? 'Save New Version'
              : 'Create Schema'}
        </Button>
      </div>
    </form>
  );
}
