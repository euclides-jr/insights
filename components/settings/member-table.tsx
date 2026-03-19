"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectChevronStyle, selectInputClass } from "@/components/ui/select";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MemberRow = {
  userId: string;
  email: string;
  name: string | null;
  role: "VIEWER" | "EDITOR" | "ADMIN";
  createdAt: string | Date;
  updatedAt: string | Date;
};

type InvitationRow = {
  id: string;
  email: string;
  role: "VIEWER" | "EDITOR" | "ADMIN";
  expiresAt: string | Date;
  createdAt: string | Date;
  inviteUrl: string | null;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function markCopied(
  invitationId: string,
  setCopiedInvitationId: (
    value: string | null | ((current: string | null) => string | null),
  ) => void,
) {
  setCopiedInvitationId(invitationId);
  window.setTimeout(() => {
    setCopiedInvitationId((current) =>
      current === invitationId ? null : current,
    );
  }, 2000);
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

export function MemberTable({
  members,
  invitations,
  currentUserId,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
}) {
  const compactSelectClass = `${selectInputClass} h-9 w-auto py-1 pr-9`;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    email: string;
    currentRole: MemberRow["role"];
    nextRole: MemberRow["role"];
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    userId: string;
    email: string;
  } | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(
    null,
  );

  async function updateRole(userId: string, role: MemberRow["role"]) {
    setBusyKey(`role:${userId}`);
    setError(null);

    try {
      const response = await fetch(`/api/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update role");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update role",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMember(userId: string) {
    setBusyKey(`remove:${userId}`);
    setError(null);

    try {
      const response = await fetch(`/api/members/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove member");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to remove member",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setBusyKey(`invite:${invitationId}`);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${invitationId}/revoke`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke invitation");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to revoke invitation",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function copyInvitationUrl(invitation: InvitationRow) {
    if (!invitation.inviteUrl) {
      setError("This invitation does not have a copyable URL");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitation.inviteUrl);
      } else if (!fallbackCopyText(invitation.inviteUrl)) {
        throw new Error("Clipboard unavailable");
      }

      markCopied(invitation.id, setCopiedInvitationId);
      setError(null);
    } catch {
      if (fallbackCopyText(invitation.inviteUrl)) {
        markCopied(invitation.id, setCopiedInvitationId);
        setError(null);
        return;
      }

      setError("Failed to copy invitation URL");
    }
  }

  return (
    <div className="space-y-8">
      <Dialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRoleChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              {pendingRoleChange
                ? `Change ${pendingRoleChange.email} from ${pendingRoleChange.currentRole.toLowerCase()} to ${pendingRoleChange.nextRole.toLowerCase()}?`
                : "Confirm the new role for this member."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingRoleChange(null)}
              disabled={busyKey !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busyKey !== null || pendingRoleChange === null}
              onClick={async () => {
                if (!pendingRoleChange) return;
                await updateRole(
                  pendingRoleChange.userId,
                  pendingRoleChange.nextRole,
                );
                setPendingRoleChange(null);
              }}
            >
              Confirm Role Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoval(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Member Removal</DialogTitle>
            <DialogDescription>
              {pendingRemoval
                ? `Remove ${pendingRemoval.email} from the workspace?`
                : "Confirm member removal."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingRemoval(null)}
              disabled={busyKey !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busyKey !== null || pendingRemoval === null}
              onClick={async () => {
                if (!pendingRemoval) return;
                await removeMember(pendingRemoval.userId);
                setPendingRemoval(null);
              }}
            >
              Confirm Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
            Members
          </h2>
          <p className="mt-2 text-sm text-[#7A7A7A]">
            Admin-only role management for the current workspace.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableCell
                width="300px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Member
              </TableCell>
              <TableCell
                width="140px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Role
              </TableCell>
              <TableCell
                width="180px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Joined
              </TableCell>
              <TableCell
                width="220px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          {members.map((member) => (
            <TableRow key={member.userId}>
              <TableCell width="300px">
                <div className="font-medium">{member.name ?? member.email}</div>
                <div className="mt-1 text-xs text-[#7A7A7A]">
                  {member.email}
                </div>
              </TableCell>
              <TableCell width="140px">
                <Badge variant="neutral">{member.role}</Badge>
              </TableCell>
              <TableCell width="180px" className="text-[#7A7A7A]">
                {formatDate(member.createdAt)}
              </TableCell>
              <TableCell width="220px">
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Role for ${member.email}`}
                    className={compactSelectClass}
                    style={selectChevronStyle}
                    value={member.role}
                    onChange={(event) => {
                      const nextRole = event.target.value as MemberRow["role"];
                      if (nextRole === member.role) {
                        return;
                      }

                      setPendingRoleChange({
                        userId: member.userId,
                        email: member.email,
                        currentRole: member.role,
                        nextRole,
                      });
                    }}
                    disabled={
                      busyKey !== null || member.userId === currentUserId
                    }
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPendingRemoval({
                        userId: member.userId,
                        email: member.email,
                      })
                    }
                    disabled={
                      busyKey !== null || member.userId === currentUserId
                    }
                  >
                    Remove
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
            Pending Invitations
          </h2>
          <p className="mt-2 text-sm text-[#7A7A7A]">
            Invitation links are shown in the dialog after creation. Revoke any
            invite that should no longer be accepted.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableCell
                width="300px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Email
              </TableCell>
              <TableCell
                width="140px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Role
              </TableCell>
              <TableCell
                width="180px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Expires
              </TableCell>
              <TableCell
                width="140px"
                className="font-medium text-xs text-[#7A7A7A]"
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          {invitations.length === 0 ? (
            <TableRow>
              <TableCell width="100%" className="text-[#7A7A7A]">
                No pending invitations.
              </TableCell>
            </TableRow>
          ) : (
            invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell width="300px" className="font-medium">
                  {invitation.email}
                </TableCell>
                <TableCell width="140px">
                  <Badge variant="neutral">{invitation.role}</Badge>
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {formatDate(invitation.expiresAt)}
                </TableCell>
                <TableCell width="160px">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInvitationUrl(invitation)}
                      disabled={busyKey !== null || !invitation.inviteUrl}
                    >
                      {copiedInvitationId === invitation.id
                        ? "Copied"
                        : "Copy URL"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvitation(invitation.id)}
                      disabled={busyKey !== null}
                    >
                      Revoke
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </Table>
      </div>
    </div>
  );
}
