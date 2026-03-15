/**
 * Prisma Client singleton mock for unit tests.
 *
 * Follows the pattern recommended by Prisma docs:
 * https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing#singleton
 *
 * Usage in a test file:
 *
 *   import { PrismaClient } from '@prisma/client';
 *   import { mockDeep, mockReset } from 'jest-mock-extended';
 *
 *   vi.mock('@/lib/db/prisma', () => ({
 *     prisma: mockDeep<PrismaClient>(),
 *   }));
 *
 *   import { prismaMock } from './prisma-singleton';
 *
 *   beforeEach(() => mockReset(prismaMock));
 *
 * The vi.mock call must live in the test file itself so Vitest can hoist it
 * above all static imports. This file exports the typed DeepMockProxy so the
 * reference stays consistent across imports.
 */

import { PrismaClient } from '@prisma/client';
import { type DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '@/lib/db/prisma';

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
