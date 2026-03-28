import type { PrismaClient, WorkspaceMember } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "jest-mock-extended";

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import {
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  runFunnel,
  updateFunnel,
} from "@/lib/services/funnel-service";
import { prismaMock } from "./prisma-singleton";

const membership = {
  id: "member-1",
  userId: "user-1",
  role: "EDITOR",
} as WorkspaceMember;

describe("funnel-service", () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  it("lists funnels with optional application and query filters", async () => {
    prismaMock.funnel.findMany.mockResolvedValueOnce([] as never);

    await listFunnels("app-1", "signup");

    expect(prismaMock.funnel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicationId: "app-1",
          name: {
            contains: "signup",
            mode: "insensitive",
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("creates a funnel with sequential step positions and creator ownership", async () => {
    prismaMock.funnel.create.mockResolvedValueOnce({
      id: "funnel-1",
      name: "Signup Funnel",
      steps: [],
    } as never);

    await createFunnel(membership, {
      applicationId: "app-1",
      name: "Signup Funnel",
      description: "Track signup to purchase",
      steps: [
        { eventName: "signup" },
        { eventName: "purchase", properties: { plan: "pro" } },
      ],
    });

    expect(prismaMock.funnel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app-1",
          name: "Signup Funnel",
          description: "Track signup to purchase",
          createdByUserId: "user-1",
          steps: {
            create: [
              {
                position: 1,
                eventName: "signup",
                properties: undefined,
              },
              {
                position: 2,
                eventName: "purchase",
                properties: { plan: "pro" },
              },
            ],
          },
        }),
      }),
    );
  });

  it("updates only provided fields and replaces steps when steps are sent", async () => {
    prismaMock.funnel.update.mockResolvedValueOnce({
      id: "funnel-1",
      name: "Updated Funnel",
      steps: [],
    } as never);

    await updateFunnel("funnel-1", membership, {
      name: "Updated Funnel",
      steps: [
        { eventName: "signup" },
        { eventName: "checkout" },
        { eventName: "purchase" },
      ],
    });

    expect(prismaMock.funnel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "funnel-1" },
        data: {
          name: "Updated Funnel",
          steps: {
            deleteMany: {},
            create: [
              { position: 1, eventName: "signup", properties: undefined },
              { position: 2, eventName: "checkout", properties: undefined },
              { position: 3, eventName: "purchase", properties: undefined },
            ],
          },
        },
      }),
    );
  });

  it("loads a funnel by id with ordered steps", async () => {
    prismaMock.funnel.findUnique.mockResolvedValueOnce({
      id: "funnel-1",
      steps: [{ position: 1, eventName: "signup" }],
    } as never);

    const result = await getFunnel("funnel-1");

    expect(result?.id).toBe("funnel-1");
    expect(prismaMock.funnel.findUnique).toHaveBeenCalledWith({
      where: { id: "funnel-1" },
      include: {
        steps: {
          orderBy: { position: "asc" },
        },
      },
    });
  });

  it("deletes a funnel by id", async () => {
    prismaMock.funnel.delete.mockResolvedValueOnce({ id: "funnel-1" } as never);

    await deleteFunnel("funnel-1", membership);

    expect(prismaMock.funnel.delete).toHaveBeenCalledWith({
      where: { id: "funnel-1" },
    });
  });

  it("runs ordered funnel SQL and computes conversion and drop-off rates", async () => {
    prismaMock.funnel.findUnique.mockResolvedValueOnce({
      id: "funnel-1",
      applicationId: "app-1",
      steps: [
        { position: 1, eventName: "signup", properties: null },
        {
          position: 2,
          eventName: "purchase",
          properties: { plan: "pro" },
        },
      ],
    } as never);
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { position: 1, eventName: "signup", users: 100n },
      { position: 2, eventName: "purchase", users: 40n },
    ] as never);

    const result = await runFunnel("funnel-1", {
      timeWindow: { value: 30, unit: "days" },
    });

    expect(result).toEqual([
      {
        position: 1,
        eventName: "signup",
        users: 100,
        conversionRate: null,
        dropOffRate: null,
      },
      {
        position: 2,
        eventName: "purchase",
        users: 40,
        conversionRate: 0.4,
        dropOffRate: 0.6,
      },
    ]);

    const [sql, ...params] = prismaMock.$queryRawUnsafe.mock.calls[0] ?? [];
    expect(String(sql)).toContain(
      'JOIN step1 prev ON prev."userId" = e."userId"',
    );
    expect(String(sql)).toContain("e.properties @> $5::jsonb");
    expect(params[0]).toBe("app-1");
    expect(params[2]).toBe("signup");
    expect(params[3]).toBe("purchase");
    expect(params[4]).toBe(JSON.stringify({ plan: "pro" }));
  });

  it("throws when running a missing funnel", async () => {
    prismaMock.funnel.findUnique.mockResolvedValueOnce(null);

    await expect(
      runFunnel("missing-funnel", {
        timeWindow: { value: 7, unit: "days" },
      }),
    ).rejects.toThrow("Funnel missing-funnel not found");
  });
});
