import type {
  Funnel,
  FunnelStep,
  Prisma,
  WorkspaceMember,
} from '@prisma/client';

export type FunnelWithSteps = Funnel & { steps: FunnelStep[] };

export type CreateFunnelInput = {
  applicationId: string;
  name: string;
  description?: string;
  steps: Array<{
    eventName: string;
    properties?: Prisma.JsonObject;
  }>;
};

export type RunFunnelInput = {
  timeWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
};

export type FunnelStepResult = {
  position: number;
  eventName: string;
  users: number;
  conversionRate: number | null;
  dropOffRate: number | null;
};

export async function listFunnels(_applicationId?: string, _query?: string) {
  void _applicationId;
  void _query;
  throw new Error('not implemented');
}

export async function createFunnel(
  _membership: WorkspaceMember,
  _input: CreateFunnelInput,
) {
  void _membership;
  void _input;
  throw new Error('not implemented');
}

export async function getFunnel(_id: string): Promise<FunnelWithSteps | null> {
  void _id;
  throw new Error('not implemented');
}

export async function updateFunnel(
  _id: string,
  _membership: WorkspaceMember,
  _input: Partial<CreateFunnelInput>,
) {
  void _id;
  void _membership;
  void _input;
  throw new Error('not implemented');
}

export async function deleteFunnel(_id: string, _membership: WorkspaceMember) {
  void _id;
  void _membership;
  throw new Error('not implemented');
}

export async function runFunnel(
  _id: string,
  _input: RunFunnelInput,
): Promise<FunnelStepResult[]> {
  void _id;
  void _input;
  throw new Error('not implemented');
}
