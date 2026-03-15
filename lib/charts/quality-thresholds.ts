// ─── Alert thresholds shared between the quality API route and chart components
// This file must NOT import any Node.js-only modules so it is safe to use in
// both server and client contexts.

export const THRESHOLDS = {
  validationFailureRate: { warning: 0.05, error: 0.15 },
  completenessRate: { warning: 0.9, error: 0.75 }, // below = bad
  duplicateRate: { warning: 0.05, error: 0.15 },
} as const;

export type AlertLevel = 'ok' | 'warning' | 'error';

export function failureRateAlert(rate: number): AlertLevel {
  if (rate >= THRESHOLDS.validationFailureRate.error) return 'error';
  if (rate >= THRESHOLDS.validationFailureRate.warning) return 'warning';
  return 'ok';
}

export function completenessAlert(rate: number): AlertLevel {
  if (rate <= THRESHOLDS.completenessRate.error) return 'error';
  if (rate <= THRESHOLDS.completenessRate.warning) return 'warning';
  return 'ok';
}

export function duplicateRateAlert(rate: number): AlertLevel {
  if (rate >= THRESHOLDS.duplicateRate.error) return 'error';
  if (rate >= THRESHOLDS.duplicateRate.warning) return 'warning';
  return 'ok';
}

/** Highest severity among a set of levels. */
export function overallAlert(...levels: AlertLevel[]): AlertLevel {
  if (levels.includes('error')) return 'error';
  if (levels.includes('warning')) return 'warning';
  return 'ok';
}
