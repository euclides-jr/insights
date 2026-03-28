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

vi.mock("@/lib/services/funnel-service", () => ({
  createFunnel: vi.fn(),
  deleteFunnel: vi.fn(),
  getFunnel: vi.fn(),
  listFunnels: vi.fn(),
  runFunnel: vi.fn(),
  updateFunnel: vi.fn(),
}));

import { AuthError, ForbiddenError, requireRole } from "@/lib/auth/roles";
import {
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  runFunnel,
  updateFunnel,
} from "@/lib/services/funnel-service";
import {
  GET as listFunnelsRoute,
  POST as createFunnelRoute,
} from "@/app/api/funnels/route";
import {
  DELETE as deleteFunnelRoute,
  GET as getFunnelRoute,
  PATCH as updateFunnelRoute,
} from "@/app/api/funnels/[id]/route";
import { POST as runFunnelRoute } from "@/app/api/funnels/[id]/run/route";

const membership = {
  id: "member-1",
  userId: "user-1",
  role: WorkspaceRole.EDITOR,
};

describe("funnels api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists funnels for an authenticated viewer", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    vi.mocked(listFunnels).mockResolvedValueOnce([
      { id: "funnel-1", name: "Signup Funnel" },
    ] as never);

    const response = await listFunnelsRoute(
      new NextRequest(
        "http://localhost:3000/api/funnels?applicationId=app-1&q=signup",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      funnels: [{ id: "funnel-1", name: "Signup Funnel" }],
    });
    expect(requireRole).toHaveBeenCalledWith(WorkspaceRole.VIEWER);
    expect(listFunnels).toHaveBeenCalledWith("app-1", "signup");
  });

  it("returns 400 for invalid list query params", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);

    const response = await listFunnelsRoute(
      new NextRequest(`http://localhost:3000/api/funnels?q=${"x".repeat(121)}`),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Validation failed" });
  });

  it("creates a funnel for an editor", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(membership as never);
    vi.mocked(createFunnel).mockResolvedValueOnce({
      id: "funnel-1",
      name: "Signup Funnel",
    } as never);

    const response = await createFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          name: "Signup Funnel",
          steps: [{ eventName: "signup" }, { eventName: "purchase" }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "funnel-1",
      name: "Signup Funnel",
    });
    expect(requireRole).toHaveBeenCalledWith(WorkspaceRole.EDITOR);
  });

  it("returns auth and forbidden errors from list/create routes", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthError());

    const listResponse = await listFunnelsRoute(
      new NextRequest("http://localhost:3000/api/funnels"),
    );
    expect(listResponse.status).toBe(401);

    vi.mocked(requireRole).mockRejectedValueOnce(new ForbiddenError());
    const createResponse = await createFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          name: "Signup Funnel",
          steps: [{ eventName: "signup" }, { eventName: "purchase" }],
        }),
      }),
    );
    expect(createResponse.status).toBe(403);
  });

  it("fetches a funnel by id and returns 404 when missing", async () => {
    vi.mocked(requireRole).mockResolvedValue(membership as never);
    vi.mocked(getFunnel)
      .mockResolvedValueOnce({
        id: "funnel-1",
        applicationId: "app-1",
      } as never)
      .mockResolvedValueOnce(null);

    const success = await getFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1"),
      {
        params: Promise.resolve({ id: "funnel-1" }),
      },
    );
    expect(success.status).toBe(200);

    const missing = await getFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/missing"),
      {
        params: Promise.resolve({ id: "missing" }),
      },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Funnel not found" });
  });

  it("updates a funnel and validates missing or invalid payloads", async () => {
    vi.mocked(requireRole).mockResolvedValue(membership as never);
    vi.mocked(getFunnel).mockResolvedValueOnce({ id: "funnel-1" } as never);
    vi.mocked(updateFunnel).mockResolvedValueOnce({
      id: "funnel-1",
      name: "Updated Funnel",
    } as never);

    const success = await updateFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Funnel" }),
      }),
      { params: Promise.resolve({ id: "funnel-1" }) },
    );
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({
      id: "funnel-1",
      name: "Updated Funnel",
    });

    const invalid = await updateFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "funnel-1" }) },
    );
    expect(invalid.status).toBe(400);

    vi.mocked(getFunnel).mockResolvedValueOnce(null);
    const missing = await updateFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/missing", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Funnel" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(missing.status).toBe(404);
  });

  it("deletes a funnel and returns 204", async () => {
    vi.mocked(requireRole).mockResolvedValue(membership as never);
    vi.mocked(getFunnel).mockResolvedValueOnce({ id: "funnel-1" } as never);
    vi.mocked(deleteFunnel).mockResolvedValueOnce(undefined as never);

    const response = await deleteFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "funnel-1" }) },
    );

    expect(response.status).toBe(204);
    expect(deleteFunnel).toHaveBeenCalledWith("funnel-1", membership);
  });

  it("runs a funnel and rejects mismatched application ids", async () => {
    vi.mocked(requireRole).mockResolvedValue(membership as never);
    vi.mocked(getFunnel)
      .mockResolvedValueOnce({
        id: "funnel-1",
        applicationId: "app-1",
      } as never)
      .mockResolvedValueOnce({
        id: "funnel-1",
        applicationId: "app-1",
      } as never);
    vi.mocked(runFunnel).mockResolvedValueOnce([
      { position: 1, eventName: "signup", users: 10 },
    ] as never);

    const success = await runFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-1",
          timeWindow: { value: 30, unit: "days" },
        }),
      }),
      { params: Promise.resolve({ id: "funnel-1" }) },
    );

    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({
      funnelId: "funnel-1",
      steps: [{ position: 1, eventName: "signup", users: 10 }],
    });

    const mismatch = await runFunnelRoute(
      new NextRequest("http://localhost:3000/api/funnels/funnel-1/run", {
        method: "POST",
        body: JSON.stringify({
          applicationId: "app-2",
          timeWindow: { value: 30, unit: "days" },
        }),
      }),
      { params: Promise.resolve({ id: "funnel-1" }) },
    );
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({
      error: "applicationId does not match funnel application",
    });
  });
});
