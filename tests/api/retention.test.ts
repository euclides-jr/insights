import { WorkspaceRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/roles", () => {
  class AuthError extends Error {
    status = 401;
    constructor(message = "Authentication required") {
      super(message);
      this.name = "AuthError";
    }
  }

  class ForbiddenError extends Error {
    status = 403;
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  }

  return {
    AuthError,
    ForbiddenError,
    requireRole: vi.fn(),
  };
});

vi.mock("@/lib/services/retention-service", () => ({
  runRetention: vi.fn(),
}));

import { AuthError, ForbiddenError, requireRole } from "@/lib/auth/roles";
import { runRetention } from "@/lib/services/retention-service";
import { POST } from "@/app/api/retention/run/route";

describe("retention api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs retention for a viewer", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      role: WorkspaceRole.VIEWER,
    } as never);
    vi.mocked(runRetention).mockResolvedValueOnce({
      applicationId: "app-1",
      interval: "weekly",
      buckets: ["W0", "W1"],
      cohorts: [],
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/retention/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          interval: "weekly",
          cohortWindow: { value: 4, unit: "weeks" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applicationId: "app-1",
      interval: "weekly",
      buckets: ["W0", "W1"],
      cohorts: [],
    });
    expect(requireRole).toHaveBeenCalledWith(WorkspaceRole.VIEWER);
  });

  it("returns 400 for invalid payloads", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      role: WorkspaceRole.VIEWER,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/retention/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "",
          interval: "monthly",
          cohortWindow: { value: 99, unit: "years" },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Validation failed" });
  });

  it("maps auth and forbidden errors", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthError());

    const unauthorized = await POST(
      new NextRequest("http://localhost:3000/api/retention/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          interval: "weekly",
          cohortWindow: { value: 4, unit: "weeks" },
        }),
      }),
    );
    expect(unauthorized.status).toBe(401);

    vi.mocked(requireRole).mockRejectedValueOnce(new ForbiddenError());
    const forbidden = await POST(
      new NextRequest("http://localhost:3000/api/retention/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          interval: "weekly",
          cohortWindow: { value: 4, unit: "weeks" },
        }),
      }),
    );
    expect(forbidden.status).toBe(403);
  });
});
