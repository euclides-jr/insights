import type {
  Prisma,
  SavedReport,
  SavedReportType,
  WorkspaceMember,
} from '@prisma/client';

export type SavedReportConfig = Prisma.JsonObject;

export type CreateSavedReportInput = {
  name: string;
  reportType: SavedReportType;
  applicationId?: string | null;
  config: SavedReportConfig;
};

export async function listSavedReports(
  _reportType?: SavedReportType,
  _applicationId?: string,
) {
  void _reportType;
  void _applicationId;
  throw new Error('not implemented');
}

export async function createSavedReport(
  _membership: WorkspaceMember,
  _input: CreateSavedReportInput,
): Promise<SavedReport> {
  void _membership;
  void _input;
  throw new Error('not implemented');
}

export async function getSavedReport(_id: string): Promise<SavedReport | null> {
  void _id;
  throw new Error('not implemented');
}

export async function updateSavedReport(
  _id: string,
  _membership: WorkspaceMember,
  _input: Partial<CreateSavedReportInput>,
) {
  void _id;
  void _membership;
  void _input;
  throw new Error('not implemented');
}

export async function deleteSavedReport(
  _id: string,
  _membership: WorkspaceMember,
) {
  void _id;
  void _membership;
  throw new Error('not implemented');
}
