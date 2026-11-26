import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  DEFAULT_RESERVED,
  MAX_HISTORY,
  normalizeSlug,
  isUnsafeSlug,
  isValidSlug,
  parseReserved,
  checkEntries,
  summaryText,
  historyText,
  isState,
  slugUniquenessCheckerTool,
  serializeState,
  deserializeState,
  withHistory,
  roundTrips,
} from '@/tool';
import type { ToolState } from '@/tool/types';

const state = (overrides: Partial<ToolState> = {}): ToolState => ({
  ...DEFAULT_STATE,
  ...overrides,
});

describe('normalizeSlug', () => {
  it('passes through valid slugs untouched', () => {
    expect(normalizeSlug('getting-started', { caseInsensitive: true, unicodeAware: true })).toBe(
      'getting-started'
    );
    expect(normalizeSlug('a1', { caseInsensitive: false, unicodeAware: false })).toBe('a1');
  });

  it('folds titles to slugs', () => {
    expect(normalizeSlug('Getting Started!', { caseInsensitive: true, unicodeAware: true })).toBe(
      'getting-started'
    );
    expect(
      normalizeSlug('Hello, World & Friends', { caseInsensitive: true, unicodeAware: true })
    ).toBe('hello-world-friends');
  });

  it('collapses repeated separators and trims edges', () => {
    expect(normalizeSlug('  A -- B--C  ', { caseInsensitive: true, unicodeAware: true })).toBe(
      'a-b-c'
    );
    expect(normalizeSlug('.lead.', { caseInsensitive: true, unicodeAware: true })).toBe('lead');
  });

  it('supports unicode-aware folding of accents', () => {
    expect(normalizeSlug('Café Über', { caseInsensitive: true, unicodeAware: true })).toBe(
      'cafe-uber'
    );
  });

  it('keeps accents when unicode folding is off', () => {
    expect(normalizeSlug('Café', { caseInsensitive: true, unicodeAware: false })).toBe('caf');
  });

  it('respects case-sensitivity toggle', () => {
    expect(normalizeSlug('About', { caseInsensitive: false, unicodeAware: true })).toBe('About');
  });
});

describe('format checks', () => {
  it('flags URL-unsafe characters', () => {
    expect(isUnsafeSlug('my page')).toBe(true);
    expect(isUnsafeSlug('café')).toBe(true);
    expect(isUnsafeSlug('a--b')).toBe(true);
    expect(isUnsafeSlug('-lead')).toBe(true);
    expect(isUnsafeSlug('trail-')).toBe(true);
    expect(isUnsafeSlug('clean-slug')).toBe(false);
  });

  it('recognizes canonical slugs', () => {
    expect(isValidSlug('clean-slug')).toBe(true);
    expect(isValidSlug('Clean Slug')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('reserved words', () => {
  it('parses comma and newline separated entries', () => {
    expect(parseReserved('admin, api\nlogin')).toEqual(['admin', 'api', 'login']);
    expect(parseReserved('')).toEqual([]);
  });

  it('flags configured reserved entries', () => {
    const report = checkEntries('Admin\nmy-page', state({ reservedWords: DEFAULT_RESERVED }));
    expect(report.entries[0]!.status).toBe('reserved');
    expect(report.entries[1]!.status).toBe('valid');
    expect(report.reservedCount).toBe(1);
  });
});

describe('checkEntries', () => {
  it('detects exact duplicates in a slug list', () => {
    const report = checkEntries('my-page\nmy-page\nother', state());
    expect(report.entries.map((e) => e.status)).toEqual(['valid', 'duplicate', 'valid']);
    expect(report.duplicateCount).toBe(1);
    expect(report.entries[1]!.reason).toContain('entry #1');
  });

  it('detects collisions between distinct titles normalizing to the same slug', () => {
    const report = checkEntries('About\nabout', state({ unicodeAware: false }));
    expect(report.entries[0]!.status).toBe('valid');
    expect(report.entries[1]!.status).toBe('collision');
    expect(report.duplicateCount).toBe(1);
    expect(report.entries[1]!.reason).toContain('Collides with entry #1');
  });

  it('treats case-only differences as collisions when case-insensitive', () => {
    const report = checkEntries('About\nABOUT', state({ unicodeAware: false }));
    expect(report.entries[1]!.status).toBe('collision');
  });

  it('keeps case-only differences distinct when case sensitivity is on', () => {
    const report = checkEntries(
      'About\nABOUT',
      state({ caseInsensitive: false, unicodeAware: false })
    );
    expect(report.entries.map((e) => e.status)).toEqual(['valid', 'valid']);
    expect(report.uniqueSlugs).toBe(2);
  });

  it('flags entries with URL-unsafe or invalid characters', () => {
    const report = checkEntries('hello world\nokay-slug\nbad!!', state());
    expect(report.entries[0]!.status).toBe('invalid');
    expect(report.entries[1]!.status).toBe('valid');
    expect(report.entries[2]!.status).toBe('invalid');
    expect(report.invalidCount).toBe(2);
  });

  it('skips empty lines', () => {
    const report = checkEntries('\n\na\n\n', state());
    expect(report.entries).toHaveLength(1);
  });

  it('handles the empty list', () => {
    const report = checkEntries('', state());
    expect(report.entries).toHaveLength(0);
    expect(report.validCount).toBe(0);
    expect(summaryText(state({ input: '' }))).toContain('No entries');
  });

  it('counts unique slugs and reserved entries beyond duplicates', () => {
    const report = checkEntries('admin\nadmin\nabout', state());
    expect(report.entries.map((e) => e.status)).toEqual(['reserved', 'reserved', 'valid']);
    expect(report.reservedCount).toBe(2);
    expect(report.uniqueSlugs).toBe(1);
  });
});

describe('summary counts', () => {
  it('reflects all categorized entries', () => {
    const input = 'okay-slug\nokay-slug\nhello world\nAdmin\nanother';
    const report = checkEntries(input, state());
    expect(report.validCount).toBe(2);
    expect(report.duplicateCount).toBe(1);
    expect(report.invalidCount).toBe(1);
    expect(report.reservedCount).toBe(1);
    expect(summaryText(state({ input }))).toBe(
      '2 valid, 1 duplicate, 1 reserved, 1 invalid of 5 entries'
    );
    expect(historyText(state({ input }))).toBe(summaryText(state({ input })));
  });
});

describe('state round-trip', () => {
  it('serializes and deserializes losslessly', () => {
    const s = state({ input: 'a\nb', caseInsensitive: false });
    expect(roundTrips(s)).toBe(true);
    expect(deserializeState(JSON.parse(serializeState(s)))).toEqual({ success: true, data: s });
  });

  it('rejects non-object payloads with an error', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1]).success).toBe(false);
  });

  it('repairs missing or wrong-typed fields with defaults', () => {
    const restored = deserializeState({ input: 'x', caseInsensitive: 'yes', history: 'bad' });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.caseInsensitive).toBe(DEFAULT_STATE.caseInsensitive);
      expect(restored.data.unicodeAware).toBe(DEFAULT_STATE.unicodeAware);
      expect(restored.data.reservedWords).toBe(DEFAULT_STATE.reservedWords);
      expect(restored.data.history).toEqual([]);
    }
  });

  it('caps restored history at MAX_HISTORY', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `e${i}`,
      createdAt: new Date(i).toISOString(),
    }));
    const restored = deserializeState({ history: entries });
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.history).toHaveLength(MAX_HISTORY);
  });

  it('appends history newest first with a cap', () => {
    let s = state();
    s = withHistory(s, 'first', new Date(1));
    s = withHistory(s, 'second', new Date(2));
    expect(s.history.map((h) => h.text)).toEqual(['second', 'first']);
    for (let i = 0; i < MAX_HISTORY + 3; i++) s = withHistory(s, `h${i}`);
    expect(s.history).toHaveLength(MAX_HISTORY);
  });

  it('validates state shape', () => {
    expect(isState({ input: 'x' })).toBe(true);
    expect(isState({})).toBe(false);
    expect(isState(null)).toBe(false);
  });
});

describe('tool contract', () => {
  it('exposes id, name, and initial state', () => {
    expect(slugUniquenessCheckerTool.id).toBe('slug-uniqueness-checker');
    expect(slugUniquenessCheckerTool.name).toBe('Slug Uniqueness Checker');
    expect(slugUniquenessCheckerTool.initialState).toEqual(DEFAULT_STATE);
  });

  it('round-trips through the tool interface', () => {
    const tool = slugUniquenessCheckerTool;
    const s = state({ input: 'demo' });
    const restored = tool.deserialize(JSON.parse(tool.serialize(s)));
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data).toEqual(s);
  });
});
