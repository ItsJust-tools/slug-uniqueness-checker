'use client';

import React from 'react';
import { checkEntries } from '../types';
import { ENTRY_STATUS_LABELS } from '../ui-shared';
import type { EntryCheck, ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  valid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  duplicate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  collision: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  reserved: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  invalid: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy entry"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const report = checkEntries(state.input, state);

  return (
    <div className="space-y-6 p-4">
      <section>
        <label
          htmlFor="slug-input"
          className="block text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          Slugs or titles (one per line)
        </label>
        <textarea
          id="slug-input"
          data-testid="slug-input"
          rows={8}
          value={state.input}
          onChange={(e) => update({ input: e.target.value })}
          placeholder={'getting-started\nGetting Started!\nmy-page'}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2" data-testid="options-panel">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Reserved words (comma-separated)
          <input
            type="text"
            value={state.reservedWords}
            onChange={(e) => update({ reservedWords: e.target.value })}
            data-testid="reserved-input"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={state.caseInsensitive}
              onChange={(e) => update({ caseInsensitive: e.target.checked })}
              data-testid="toggle-case-insensitive"
            />
            Case-insensitive comparison
          </label>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={state.unicodeAware}
              onChange={(e) => update({ unicodeAware: e.target.checked })}
              data-testid="toggle-unicode-aware"
            />
            Unicode-aware normalization
          </label>
        </div>
      </section>

      <section data-testid="summary-counts">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center text-sm">
          <div className="rounded-md border border-green-300 p-3" data-testid="count-valid">
            <div className="text-2xl font-bold text-green-700">{report.validCount}</div>
            Valid
          </div>
          <div className="rounded-md border border-amber-300 p-3" data-testid="count-duplicate">
            <div className="text-2xl font-bold text-amber-700">{report.duplicateCount}</div>
            Duplicates
          </div>
          <div className="rounded-md border border-red-300 p-3" data-testid="count-invalid">
            <div className="text-2xl font-bold text-red-700">{report.invalidCount}</div>
            Invalid
          </div>
          <div className="rounded-md border border-purple-300 p-3" data-testid="count-reserved">
            <div className="text-2xl font-bold text-purple-700">{report.reservedCount}</div>
            Reserved
          </div>
        </div>
        {onSaveHistory ? (
          <button
            type="button"
            onClick={() =>
              onSaveHistory(
                `Checked ${report.entries.length} entries: ${report.validCount} valid, ${report.duplicateCount} duplicate, ${report.invalidCount} invalid`
              )
            }
            data-testid="btn-save-check"
            className="mt-3 rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Save check to history
          </button>
        ) : null}
      </section>

      <section data-testid="results-table">
        <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Entry status</h2>
        {report.entries.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="results-empty">
            No entries to check — paste slugs or titles above.
          </p>
        ) : (
          <ul
            className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
            data-testid="results-list"
          >
            {report.entries.map((entry: EntryCheck, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-3 px-3 py-2"
                data-testid={`result-row-${index}`}
              >
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                  {entry.raw}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">→ {entry.slug}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[entry.status]}`}
                    data-testid={`result-status-${index}`}
                  >
                    {ENTRY_STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  <CopyButton value={entry.slug} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
