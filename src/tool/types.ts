export interface HistoryEntry {
  /** Short human readable description of the check. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export type EntryStatus = 'valid' | 'duplicate' | 'collision' | 'reserved' | 'invalid';

export interface ToolState {
  /** Raw pasted input, one slug or title per line. */
  input: string;
  /** Comma-separated reserved words blacklist (supports slugs and natural titles). */
  reservedWords: string;
  /** Treat entries case-insensitively when comparing. */
  caseInsensitive: boolean;
  /** Use unicode-aware slug normalization (strip diacritics via NFKD). */
  unicodeAware: boolean;
  /** Saved check summaries, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  input: 'getting-started\nGetting Started!\nmy-page\nabout\nAdmin\n',
  reservedWords: 'admin, api, login, dashboard, settings',
  caseInsensitive: true,
  unicodeAware: true,
  history: [],
};

export const MAX_HISTORY = 20;

/** Default reserved slugs pre-seeded into the blacklist input. */
export const DEFAULT_RESERVED = 'admin, api, login, dashboard, settings';

/**
 * Normalize a raw entry to a URL slug.
 * Applies NFKD unicode folding when `unicodeAware`, strips diacritics,
 * lowercases (optionally accent-preserving) and replaces invalid
 * characters with hyphens.
 */
export function normalizeSlug(
  raw: string,
  options: { caseInsensitive: boolean; unicodeAware: boolean }
): string {
  let text = raw.trim();
  if (!text) return '';
  if (options.unicodeAware && text.normalize) {
    // NFKD folds accented characters into base letter + combining mark.
    text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }
  if (options.caseInsensitive) {
    text = text.toLowerCase();
  }
  return (
    text
      // Anything that is not a word char, hyphen, dot, or underscore becomes a hyphen.
      .replace(/[^\w.-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
  );
}

/** Characters that are unsafe or invalid in a URL slug. */
const UNSAFE_PATTERN = /[^\w-]/;
/** A valid slug: letters, digits, hyphens; no leading/trailing hyphen; no doubled hyphens. */
const VALID_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when the raw entry contains URL-unsafe or format-invalid characters. */
export function isUnsafeSlug(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return UNSAFE_PATTERN.test(trimmed) || /-{2,}|^-|-$/.test(trimmed);
}

/** True when the trimmed entry is already a canonical, URL-safe slug. */
export function isValidSlug(raw: string): boolean {
  return VALID_SLUG_PATTERN.test(raw.trim());
}

/** Parse the reserved-words list (comma or newline separated). */
export function parseReserved(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export interface EntryCheck {
  /** The entry exactly as supplied (one non-empty line). */
  raw: string;
  /** Slug after normalization. */
  slug: string;
  /** Categorization of the entry. */
  status: EntryStatus;
  /** Human readable explanation for the status. */
  reason: string;
}

export interface CheckReport {
  /** One check per non-empty input line, in input order. */
  entries: EntryCheck[];
  /** Number of entries with status 'valid'. */
  validCount: number;
  /** Number of entries with status 'duplicate' or 'collision'. */
  duplicateCount: number;
  /** Number of entries with status 'reserved'. */
  reservedCount: number;
  /** Number of entries with status 'invalid'. */
  invalidCount: number;
  /** Distinct slugs after deduplication. */
  uniqueSlugs: number;
}

/**
 * Check a newline-separated list of slugs or titles.
 * Exact duplicates (same slug twice) are flagged as 'duplicate' from the
 * second occurrence on; entries with an invalid raw format are 'invalid';
 * reserved slugs are 'reserved'; remaining entries are 'valid'.
 */
export function checkEntries(input: string, options: ToolState): CheckReport {
  const reserved = new Set(parseReserved(options.reservedWords));
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizeOptions = {
    caseInsensitive: options.caseInsensitive,
    unicodeAware: options.unicodeAware,
  };

  const seen = new Map<string, number>();
  const entries: EntryCheck[] = lines.map((raw) => {
    const slug = normalizeSlug(raw, normalizeOptions);
    return { raw, slug, status: 'valid' as EntryStatus, reason: '' };
  });

  // First pass: format validity.
  for (const entry of entries) {
    if (isUnsafeSlug(entry.raw)) {
      entry.status = 'invalid';
      entry.reason = 'Contains URL-unsafe characters or has an invalid format';
    }
  }

  // Second pass: reserved words (checked before duplicates so a reserved
  // blacklisted name wins over an exact repeat of itself).
  for (const entry of entries) {
    if (entry.status !== 'valid') continue;
    if (reserved.has(entry.slug)) {
      entry.status = 'reserved';
      entry.reason = `Slug "${entry.slug}" is on the reserved-words blacklist`;
    }
  }

  // Third pass: duplicates and collisions after normalization.
  for (const entry of entries) {
    if (entry.status !== 'valid') continue;
    const previous = seen.get(entry.slug);
    if (previous !== undefined) {
      // Same raw string is an exact duplicate; differing raw strings that
      // fold to the same slug are a collision after normalization.
      const prior = entries[previous] as EntryCheck | undefined;
      const exact = prior !== undefined && entry.raw === prior.raw;
      entry.status = exact ? 'duplicate' : 'collision';
      entry.reason = exact
        ? `Duplicates entry #${previous + 1} ("${prior?.raw ?? ''}")`
        : `Collides with entry #${previous + 1} after normalization to "${entry.slug}"`;
    } else {
      seen.set(entry.slug, entries.indexOf(entry));
    }
  }

  const validCount = entries.filter((e) => e.status === 'valid').length;
  const duplicateCount = entries.filter(
    (e) => e.status === 'duplicate' || e.status === 'collision'
  ).length;
  const reservedCount = entries.filter((e) => e.status === 'reserved').length;
  const invalidCount = entries.filter((e) => e.status === 'invalid').length;

  return {
    entries,
    validCount,
    duplicateCount,
    reservedCount,
    invalidCount,
    uniqueSlugs: seen.size,
  };
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const report = checkEntries(state.input, state);
  const lines = state.input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
  if (lines === 0) return 'No entries to check — paste slugs or titles above';
  return `${report.validCount} valid, ${report.duplicateCount} duplicate, ${report.reservedCount} reserved, ${report.invalidCount} invalid of ${lines} entries`;
}

/** Build a history entry text for the current state. */
export function historyText(state: ToolState): string {
  return summaryText(state);
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.input === 'string' && DEFAULT_STATE !== undefined;
}
