'use client';

import React from 'react';
import type { ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div
      className="p-4 space-y-6 text-sm overflow-y-auto h-full"
      data-testid="slug-checker-sidebar"
    >
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Status types</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <strong>Valid</strong> — unique, URL-safe, not reserved
          </li>
          <li>
            <strong>Duplicate</strong> — exact repeat of an earlier entry
          </li>
          <li>
            <strong>Collision</strong> — different text, same normalized slug
          </li>
          <li>
            <strong>Reserved</strong> — on the reserved-words blacklist
          </li>
          <li>
            <strong>Invalid</strong> — URL-unsafe characters or bad format
          </li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Normalization</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Titles are lowercased{state.caseInsensitive ? '' : ' (currently off)'} and reduced to
          letters, digits, and hyphens{state.unicodeAware ? ' with unicode folding' : ''}.
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved checks</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current list and options; open
          it to restore this check.
        </p>
      </div>
    </div>
  );
};
