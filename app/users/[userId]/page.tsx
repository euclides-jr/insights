import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { prisma } from '@/lib/db/prisma';
import {
  getUserProfile,
  getAttributeHistory,
} from '@/lib/services/user-attribute-service';
import { formatRelativeTime } from '@/lib/format';
import { UserProfileDetailClient } from '@/components/forms/UserProfileDetailClient';

type Props = { params: Promise<{ userId: string }> };

export default async function UserDetailPage({ params }: Props) {
  const { userId } = await params;
  const decodedUserId = decodeURIComponent(userId);

  // Load all apps to find one that has this user
  const applications = await prisma.application.findMany({
    select: { id: true, name: true, apiKey: true },
    orderBy: { name: 'asc' },
  });

  // Find the first application that has a profile for this userId
  let profile = null;
  let ownerApp = applications[0];

  for (const app of applications) {
    const p = await getUserProfile(app.id, decodedUserId);
    if (p) {
      profile = p;
      ownerApp = app;
      break;
    }
  }

  if (!profile) notFound();

  // Load recent attribute history (T022)
  const historyResponse = await getAttributeHistory(
    ownerApp.id,
    decodedUserId,
    {},
  );
  const history = historyResponse.history;

  const attributes = (profile.attributes ?? {}) as Record<string, unknown>;

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#7A7A7A]">
          <Link
            href="/users"
            className="hover:text-[#0A0A0A] transition-colors"
          >
            Users
          </Link>
          <span>/</span>
          <span className="text-[#0A0A0A] font-mono">{decodedUserId}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight font-mono">
              {decodedUserId}
            </h1>
            <p className="mt-1 text-sm text-[#7A7A7A]">{ownerApp.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {profile.eventCount.toLocaleString()} events
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'First seen',
              value: formatRelativeTime(new Date(profile.firstSeen)),
            },
            {
              label: 'Last seen',
              value: formatRelativeTime(new Date(profile.lastSeen)),
            },
            {
              label: 'Total events',
              value: profile.eventCount.toLocaleString(),
            },
            { label: 'Last event', value: profile.lastEventName ?? '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="border border-[#E8E8E8] bg-white p-4 space-y-1"
            >
              <p className="text-xs text-[#7A7A7A] font-medium uppercase tracking-wide">
                {label}
              </p>
              <p className="text-sm font-medium text-[#0A0A0A] truncate">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Attributes section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
            Attributes
          </h2>
          {Object.keys(attributes).length === 0 ? (
            <p className="text-sm text-[#7A7A7A]">No attributes set yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0">
                  <TableCell
                    width="200px"
                    className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                  >
                    Key
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide">
                    Value
                  </TableCell>
                </TableRow>
              </TableHeader>
              {Object.entries(attributes).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell
                    width="200px"
                    className="font-mono text-xs text-[#3A3A3A]"
                  >
                    {key}
                  </TableCell>
                  <TableCell className="text-sm text-[#0A0A0A]">
                    {typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value ?? '')}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}

          {/* Edit attributes inline (T010) */}
          <div className="border border-[#E8E8E8] bg-white p-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">
              Update attributes
            </h3>
            <UserProfileDetailClient
              apiKey={ownerApp.apiKey}
              userId={decodedUserId}
              defaultAttributes={attributes}
            />
          </div>
        </div>

        {/* Attribute history section (T022) */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
            Attribute history
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-[#7A7A7A]">
              No attribute changes recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0">
                  <TableCell
                    width="200px"
                    className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                  >
                    Attribute
                  </TableCell>
                  <TableCell
                    width="180px"
                    className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                  >
                    Changed at
                  </TableCell>
                  <TableCell
                    width="200px"
                    className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                  >
                    Old value
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide">
                    New value
                  </TableCell>
                </TableRow>
              </TableHeader>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell
                    width="200px"
                    className="font-mono text-xs text-[#3A3A3A]"
                  >
                    {h.attributeKey}
                  </TableCell>
                  <TableCell width="180px" className="text-sm text-[#7A7A7A]">
                    {formatRelativeTime(new Date(h.changedAt))}
                  </TableCell>
                  <TableCell
                    width="200px"
                    className="text-sm text-[#7A7A7A] font-mono"
                  >
                    {h.oldValue === null || h.oldValue === undefined ? (
                      <span className="italic">null</span>
                    ) : (
                      String(h.oldValue)
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-[#0A0A0A] font-mono">
                    {h.newValue === null || h.newValue === undefined ? (
                      <span className="italic">null</span>
                    ) : (
                      String(h.newValue)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
