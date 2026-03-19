"use client";

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UsersTable, UserRow } from "@/components/tables/UsersTable";

interface Application {
  id: string;
  name: string;
  apiKey: string;
}

interface AttributeFilterRow {
  id: string;
  key: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: string;
  logic: "and" | "or";
}

interface EventFilterRow {
  id: string;
  eventName: string;
  operator: "performed" | "not_performed";
  count?: string;
  timeWindowDays?: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyAttrFilter(): AttributeFilterRow {
  return { id: uid(), key: "", operator: "eq", value: "", logic: "and" };
}

function emptyEventFilter(): EventFilterRow {
  return {
    id: uid(),
    eventName: "",
    operator: "performed",
    count: "",
    timeWindowDays: "",
  };
}

const ATTR_OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contains" },
];

interface UsersPageClientProps {
  applications: Application[];
  searchParams: Record<string, string | undefined>;
}

export function UsersPageClient({ applications }: UsersPageClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedApp, setSelectedApp] = useState(applications[0]?.id ?? "");
  const [attrFilters, setAttrFilters] = useState<AttributeFilterRow[]>([
    emptyAttrFilter(),
  ]);
  const [eventFilters, setEventFilters] = useState<EventFilterRow[]>([]);
  const [showEventFilters, setShowEventFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  const app = applications.find((a) => a.id === selectedApp);

  // ── Attribute filter helpers ──────────────────────────────────────────────
  function addAttrFilter() {
    setAttrFilters((prev) => [...prev, emptyAttrFilter()]);
  }
  function removeAttrFilter(id: string) {
    setAttrFilters((prev) =>
      prev.length > 1 ? prev.filter((f) => f.id !== id) : prev,
    );
  }
  function updateAttrFilter(id: string, patch: Partial<AttributeFilterRow>) {
    setAttrFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  // ── Event filter helpers ──────────────────────────────────────────────────
  function addEventFilter() {
    setEventFilters((prev) => [...prev, emptyEventFilter()]);
  }
  function removeEventFilter(id: string) {
    setEventFilters((prev) => prev.filter((f) => f.id !== id));
  }
  function updateEventFilter(id: string, patch: Partial<EventFilterRow>) {
    setEventFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  const runQuery = useCallback(
    (targetPage = 1) => {
      if (!app) return;
      setError(null);
      setHasQueried(true);
      setPage(targetPage);

      const validAttrFilters = attrFilters.filter((f) => f.key.trim());
      const validEventFilters = eventFilters.filter((f) => f.eventName.trim());
      const useEventQuery = showEventFilters && validEventFilters.length > 0;

      startTransition(async () => {
        try {
          let res: Response;

          if (useEventQuery) {
            // POST /api/users/query for combined attribute + event filtering
            const body = {
              filters: validAttrFilters.map((f) => ({
                key: f.key.trim(),
                operator: f.operator,
                value: f.value,
                logic: f.logic,
              })),
              eventFilters: validEventFilters.map((f) => {
                const ef: Record<string, unknown> = {
                  eventName: f.eventName.trim(),
                  operator: f.operator,
                };
                if (f.count) ef.count = parseInt(f.count, 10);
                if (f.timeWindowDays)
                  ef.timeWindow = {
                    value: parseInt(f.timeWindowDays, 10),
                    unit: "days",
                  };
                return ef;
              }),
              page: targetPage,
              pageSize: 50,
            };
            res = await fetch("/api/users/query", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": app.apiKey,
              },
              body: JSON.stringify(body),
            });
          } else {
            // GET /api/users for attribute-only filtering
            const params = new URLSearchParams({
              page: String(targetPage),
              pageSize: "50",
            });
            if (validAttrFilters.length > 0) {
              params.set(
                "filters",
                JSON.stringify(
                  validAttrFilters.map((f) => ({
                    key: f.key.trim(),
                    operator: f.operator,
                    value: f.value,
                    logic: f.logic,
                  })),
                ),
              );
            }
            res = await fetch(`/api/users?${params}`, {
              headers: { "X-API-Key": app.apiKey },
            });
          }

          if (!res.ok) {
            const data = await res.json();
            setError(data.error ?? `Request failed (${res.status})`);
            return;
          }

          const data = await res.json();
          setUsers(data.users ?? []);
          // API returns `totalCount`; local PaginationMeta uses `total`.
          const p = data.pagination;
          setPagination(
            p
              ? {
                  page: p.page,
                  pageSize: p.pageSize,
                  total: p.totalCount ?? p.total ?? 0,
                  totalPages: p.totalPages,
                }
              : { page: 1, pageSize: 50, total: 0, totalPages: 1 },
          );
        } catch {
          setError("Network error — please try again");
        }
      });
    },
    [app, attrFilters, eventFilters, showEventFilters],
  );

  const selectClass =
    "h-9 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]";

  return (
    <div className="space-y-8">
      {/* Application selector */}
      {applications.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#0A0A0A]">
            Application
          </label>
          <select
            className={selectClass}
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
          >
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Attribute filters section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wide">
          Attribute filters
        </h2>
        <div className="space-y-2">
          {attrFilters.map((f, index) => (
            <div key={f.id} className="flex items-center gap-2">
              {/* Logic selector (AND/OR) — only show after first row */}
              {index === 0 ? (
                <div className="w-19 shrink-0" aria-hidden="true" />
              ) : (
                <select
                  className={`${selectClass} w-19`}
                  value={f.logic}
                  onChange={(e) =>
                    updateAttrFilter(f.id, {
                      logic: e.target.value as "and" | "or",
                    })
                  }
                  disabled={isPending}
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>
              )}
              <input
                className={`h-9 w-36 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                  placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]`}
                placeholder="plan_type"
                value={f.key}
                onChange={(e) =>
                  updateAttrFilter(f.id, { key: e.target.value })
                }
                disabled={isPending}
              />
              <select
                className={`${selectClass} w-28`}
                value={f.operator}
                onChange={(e) =>
                  updateAttrFilter(f.id, {
                    operator: e.target.value as AttributeFilterRow["operator"],
                  })
                }
                disabled={isPending}
              >
                {ATTR_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                className={`h-9 flex-1 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                  placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]`}
                placeholder="pro"
                value={f.value}
                onChange={(e) =>
                  updateAttrFilter(f.id, { value: e.target.value })
                }
                disabled={isPending}
              />
              <button
                type="button"
                className="h-9 w-9 flex items-center justify-center border border-[#E8E8E8] bg-white
                  text-[#7A7A7A] hover:bg-[#FAFAFA] disabled:opacity-50"
                onClick={() => removeAttrFilter(f.id)}
                disabled={attrFilters.length === 1 || isPending}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addAttrFilter}
        >
          + Add filter
        </Button>
      </div>

      {/* Event behavior filters (T018) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wide">
            Event behavior
          </h2>
          <button
            type="button"
            className="text-xs text-[#E42313] hover:underline"
            onClick={() => setShowEventFilters((v) => !v)}
          >
            {showEventFilters ? "Hide" : "Expand"}
          </button>
        </div>

        {showEventFilters && (
          <div className="space-y-3 border-l-2 border-[#E8E8E8] pl-4">
            {eventFilters.length === 0 ? (
              <p className="text-sm text-[#7A7A7A]">
                No event filters. Click below to add one.
              </p>
            ) : (
              eventFilters.map((f) => (
                <div key={f.id} className="flex items-center gap-2 flex-wrap">
                  <select
                    className={`${selectClass} w-36`}
                    value={f.operator}
                    onChange={(e) =>
                      updateEventFilter(f.id, {
                        operator: e.target.value as
                          | "performed"
                          | "not_performed",
                      })
                    }
                    disabled={isPending}
                  >
                    <option value="performed">Performed</option>
                    <option value="not_performed">Not performed</option>
                  </select>
                  <input
                    className={`h-9 w-44 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                      placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]`}
                    placeholder="event_name"
                    value={f.eventName}
                    onChange={(e) =>
                      updateEventFilter(f.id, { eventName: e.target.value })
                    }
                    disabled={isPending}
                  />
                  <input
                    className={`h-9 w-20 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                      placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]`}
                    placeholder="≥ count"
                    value={f.count ?? ""}
                    type="number"
                    min="1"
                    onChange={(e) =>
                      updateEventFilter(f.id, { count: e.target.value })
                    }
                    disabled={isPending}
                  />
                  <span className="text-sm text-[#7A7A7A]">within</span>
                  <input
                    className={`h-9 w-20 rounded-none border border-[#E8E8E8] bg-white px-3 py-2 text-sm
                      placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]`}
                    placeholder="days"
                    value={f.timeWindowDays ?? ""}
                    type="number"
                    min="1"
                    onChange={(e) =>
                      updateEventFilter(f.id, {
                        timeWindowDays: e.target.value,
                      })
                    }
                    disabled={isPending}
                  />
                  <span className="text-sm text-[#7A7A7A]">days</span>
                  <button
                    type="button"
                    className="h-9 w-9 flex items-center justify-center border border-[#E8E8E8] bg-white
                      text-[#7A7A7A] hover:bg-[#FAFAFA]"
                    onClick={() => removeEventFilter(f.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addEventFilter}
            >
              + Add event filter
            </Button>
          </div>
        )}
      </div>

      {/* Query button */}
      <div>
        <Button onClick={() => runQuery(1)} disabled={isPending || !app}>
          {isPending ? "Querying…" : "Find users"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      {/* Results (T019: matchedEvents column when event filters active) */}
      {hasQueried && (
        <UsersTable
          users={users}
          pagination={pagination}
          showMatchedEvents={
            showEventFilters && eventFilters.some((f) => f.eventName.trim())
          }
        />
      )}

      {/* Pagination callbacks */}
      {hasQueried && pagination.totalPages > 1 && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1 || isPending}
            onClick={() => runQuery(page - 1)}
          >
            ← Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pagination.totalPages || isPending}
            onClick={() => runQuery(page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
