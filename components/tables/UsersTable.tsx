'use client';

import Link from 'next/link';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { formatRelativeTime } from '@/lib/format';

export interface UserRow {
  userId: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  lastEventName?: string | null;
  attributes: Record<string, unknown>;
  matchedEventCount?: number;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UsersTableProps {
  users: UserRow[];
  pagination: PaginationMeta;
  /** Extra attribute keys to surface as dedicated columns */
  attributeColumns?: string[];
  /** When true, show an additional "Matched events" column */
  showMatchedEvents?: boolean;
}

export function UsersTable({
  users,
  pagination,
  attributeColumns = [],
  showMatchedEvents = false,
}: UsersTableProps) {
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const showing =
    pagination.total === 0
      ? 'No users found'
      : `Showing ${start}–${end} of ${pagination.total}`;

  return (
    <div className="space-y-4">
      <Table>
        {/* Header */}
        <TableHeader>
          <TableRow className="border-t-0">
            <TableCell
              width="220px"
              className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
            >
              User ID
            </TableCell>
            <TableCell
              width="160px"
              className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
            >
              Last seen
            </TableCell>
            <TableCell
              width="100px"
              className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
            >
              Events
            </TableCell>
            <TableCell
              width="160px"
              className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
            >
              Last event
            </TableCell>
            {attributeColumns.map((col) => (
              <TableCell
                key={col}
                width="130px"
                className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
              >
                {col}
              </TableCell>
            ))}
            {showMatchedEvents && (
              <TableCell
                width="130px"
                className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
              >
                Matched events
              </TableCell>
            )}
          </TableRow>
        </TableHeader>

        {/* Body */}
        {users.length === 0 ? (
          <TableRow>
            <TableCell className="text-[#7A7A7A] italic py-8 text-center">
              No users match the current filters.
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <TableRow key={user.userId}>
              <TableCell width="220px" className="font-mono text-xs">
                <Link
                  href={`/users/${encodeURIComponent(user.userId)}`}
                  className="text-[#0A0A0A] hover:text-[#E42313] transition-colors"
                >
                  {user.userId}
                </Link>
              </TableCell>
              <TableCell width="160px" className="text-sm text-[#3A3A3A]">
                {formatRelativeTime(new Date(user.lastSeen))}
              </TableCell>
              <TableCell width="100px" className="text-sm text-[#3A3A3A]">
                {user.eventCount.toLocaleString()}
              </TableCell>
              <TableCell
                width="160px"
                className="text-sm text-[#7A7A7A] truncate"
              >
                {user.lastEventName ?? '—'}
              </TableCell>
              {attributeColumns.map((col) => {
                const val = user.attributes[col];
                return (
                  <TableCell
                    key={col}
                    width="130px"
                    className="text-sm text-[#3A3A3A] truncate"
                  >
                    {val === undefined || val === null ? '—' : String(val)}
                  </TableCell>
                );
              })}
              {showMatchedEvents && (
                <TableCell width="130px" className="text-sm text-[#3A3A3A]">
                  {user.matchedEventCount ?? '—'}
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </Table>

      {pagination.total > 0 && (
        <p className="text-sm text-[#7A7A7A]">{showing}</p>
      )}
    </div>
  );
}
