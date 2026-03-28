"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface AttributeRow {
  id: string;
  key: string;
  value: string;
  error?: string;
}

interface UserAttributeFormProps {
  /** Application API key — forwarded as X-API-Key */
  apiKey: string;
  userId: string;
  /** Pre-populated attribute key-value pairs */
  defaultAttributes?: Record<string, unknown>;
  onSuccess?: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function attrsToRows(attrs: Record<string, unknown>): AttributeRow[] {
  return Object.entries(attrs).map(([key, value]) => ({
    id: uid(),
    key,
    value:
      typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  }));
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;
  return trimmed;
}

export function UserAttributeForm({
  apiKey,
  userId,
  defaultAttributes = {},
  onSuccess,
}: UserAttributeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<AttributeRow[]>(
    Object.keys(defaultAttributes).length > 0
      ? attrsToRows(defaultAttributes)
      : [{ id: uid(), key: "", value: "", error: undefined }],
  );
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: uid(), key: "", value: "", error: undefined },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );
  }

  function updateRow(id: string, patch: Partial<AttributeRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setSuccess(false);

    // Client-side validation
    let valid = true;
    const updated = rows.map((row) => {
      if (!row.key.trim()) {
        valid = false;
        return { ...row, error: "Key is required" };
      }
      if (!/^[a-z0-9_]{1,128}$/.test(row.key.trim())) {
        valid = false;
        return {
          ...row,
          error: "Key must match [a-z0-9_] (1–128 chars, lowercase)",
        };
      }
      return { ...row, error: undefined };
    });
    setRows(updated);
    if (!valid) return;

    const attributes: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.key.trim()) {
        attributes[row.key.trim()] = parseValue(row.value);
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/users/identify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ userId, attributes }),
        });
        if (!res.ok) {
          const data = await res.json();
          setGlobalError(data.error ?? `Request failed (${res.status})`);
          return;
        }
        setSuccess(true);
        onSuccess?.();
      } catch {
        setGlobalError("Network error — please try again");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Row headers */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs font-medium text-[#7A7A7A] uppercase tracking-wide w-40">
          Attribute key
        </span>
        <span className="text-xs font-medium text-[#7A7A7A] uppercase tracking-wide flex-1">
          Value
        </span>
      </div>

      {/* Attribute rows */}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3">
            <div className="w-40">
              <input
                className={`
                  h-9 w-full rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                  placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]
                  ${row.error ? "border-red-500" : ""}
                `}
                placeholder="plan_type"
                value={row.key}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
                disabled={isPending}
              />
              {row.error && (
                <p className="text-xs text-red-500 mt-1">{row.error}</p>
              )}
            </div>
            <input
              className="h-9 flex-1 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
              placeholder="pro"
              value={row.value}
              onChange={(e) => updateRow(row.id, { value: e.target.value })}
              disabled={isPending}
            />
            <button
              type="button"
              className="h-9 w-9 flex items-center justify-center border border-[#E8E8E8] bg-white
                text-[#7A7A7A] hover:bg-[#FAFAFA] disabled:opacity-50"
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1 || isPending}
              title="Remove row"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addRow}
        disabled={isPending}
      >
        + Add attribute
      </Button>

      {/* Global error */}
      {globalError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 px-3 py-2">
          {globalError}
        </p>
      )}

      {/* Success */}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2">
          Attributes saved successfully.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save attributes"}
        </Button>
      </div>
    </form>
  );
}
