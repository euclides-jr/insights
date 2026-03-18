import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth/api-auth';

// Validation schema for creating an application
const createApplicationSchema = z.object({
  name: z
    .string()
    .min(1, 'Application name is required')
    .max(100, 'Application name must be less than 100 characters'),
  description: z.string().optional(),
});

/**
 * POST /api/applications
 *
 * Creates a new application with auto-generated API key
 *
 * Body: Application details
 *
 * @example
 * ```json
 * {
 *   "name": "My Mobile App",
 *   "description": "iOS app for event tracking"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!auth.ok) return authResult.response;
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = createApplicationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { name } = validationResult.data;

    // Generate unique API key
    const apiKey = `app_${randomBytes(24).toString('hex')}`;

    // Create application
    const application = await prisma.application.create({
      data: {
        name,
        apiKey,
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        application,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating application:', error);

    // Handle unique constraint violations (duplicate name or API key collision)
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'An application with this name already exists' },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/applications
 *
 * Returns list of all applications
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!auth.ok) return authResult.response;
  try {
    const applications = await prisma.application.findMany({
      select: {
        id: true,
        name: true,
        apiKey: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 },
    );
  }
}
