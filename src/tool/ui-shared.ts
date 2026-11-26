import { DEFAULT_STATE, type ToolState } from './types';

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.input === 'string' && DEFAULT_STATE !== undefined;
}

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  valid: 'Valid',
  duplicate: 'Duplicate',
  collision: 'Collision',
  reserved: 'Reserved',
  invalid: 'Invalid',
};
