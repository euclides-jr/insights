export type RunRetentionInput = {
  applicationId: string;
  interval: 'daily' | 'weekly';
  cohortWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
  returnEventName?: string;
};

export type RetentionCell = {
  bucket: string;
  users: number;
  rate: number;
};

export type RetentionCohortRow = {
  cohortStart: string;
  cohortSize: number;
  cells: RetentionCell[];
};

export async function runRetention(
  _input: RunRetentionInput,
): Promise<RetentionCohortRow[]> {
  void _input;
  throw new Error('not implemented');
}
