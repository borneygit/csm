import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SessionMeta } from '../types.ts';

interface ListViewProps {
  sessions: SessionMeta[];
  selectedIndex: number;
  filterText: string;
  isFiltering: boolean;
  isFilterActive: boolean;
  selectedIds: Set<string>;
  projectPath: string;
  source: 'claude' | 'codex';
  onSelect: (index: number) => void;
  onEnter: () => void;
  onBack: () => void;
  onDelete: () => void;
  onFilterChange: (text: string) => void;
  onFilterToggle: () => void;
  onSelectionToggle: (id: string) => void;
  onClearFilter: () => void;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function visualWidth(s: string): number {
  let w = 0;
  for (const c of s) {
    const cp = c.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115F) ||
      (cp >= 0x2E80 && cp <= 0x9FFF) ||
      (cp >= 0xAC00 && cp <= 0xD7AF) ||
      (cp >= 0xF900 && cp <= 0xFAFF) ||
      (cp >= 0xFE10 && cp <= 0xFE6F) ||
      (cp >= 0xFF00 && cp <= 0xFF60) ||
      (cp >= 0xFFE0 && cp <= 0xFFE6) ||
      (cp >= 0x1F300 && cp <= 0x1F9FF) ||
      (cp >= 0x20000 && cp <= 0x2A6DF);
    w += wide ? 2 : 1;
  }
  return w;
}

function truncate(s: string, maxLen: number): string {
  let w = 0;
  let i = 0;
  for (const c of s) {
    const cp = c.codePointAt(0) ?? 0;
    const cw = ((cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0x9FFF) ||
      (cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0xF900 && cp <= 0xFAFF) ||
      (cp >= 0xFE10 && cp <= 0xFE6F) || (cp >= 0xFF00 && cp <= 0xFF60) ||
      (cp >= 0xFFE0 && cp <= 0xFFE6) || (cp >= 0x1F300 && cp <= 0x1F9FF) ||
      (cp >= 0x20000 && cp <= 0x2A6DF)) ? 2 : 1;
    if (w + cw > maxLen - 1) break;
    w += cw;
    i += c.length;
  }
  const vw = visualWidth(s);
  if (vw <= maxLen) return s + ' '.repeat(maxLen - vw);
  return s.slice(0, i) + '…' + ' '.repeat(maxLen - w - 1);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatTokens(n: number): string {
  if (n === 0) return '    -';
  if (n < 1000) return String(n).padStart(5);
  return `${(n / 1000).toFixed(1)}k`.padStart(5);
}

export function ListView({
  sessions,
  selectedIndex,
  filterText,
  isFiltering,
  isFilterActive,
  selectedIds,
  projectPath,
  onSelect,
  onEnter,
  onBack,
  onDelete,
  onFilterChange,
  onFilterToggle,
  onSelectionToggle,
  onClearFilter,
  source,
}: ListViewProps) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 100;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useInput((input, key) => {
    if (isFiltering) {
      if (key.escape) {
        onFilterToggle();
        return;
      }
      if (key.return) {
        onFilterToggle();
        return;
      }
      if (key.backspace || key.delete) {
        onFilterChange(filterText.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        onFilterChange(filterText + input);
      }
      return;
    }

    if (key.escape || input === 'b') {
      if (isFilterActive) { onClearFilter(); }
      else { onBack(); }
      return;
    }

    if (key.upArrow) {
      onSelect(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      onSelect(Math.min(sessions.length - 1, selectedIndex + 1));
    } else if (key.return) {
      onEnter();
    } else if (input === 'd') {
      onDelete();
    } else if (input === '/') {
      onFilterToggle();
    } else if (input === ' ') {
      const id = sessions[selectedIndex]?.id;
      if (!id) return;
      if (isFilterActive) {
        onSelectionToggle(id);
      } else {
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      }
    }
  });

  // Visible window
  const maxVisible = Math.max(5, (stdout?.rows || 24) - 8);
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), sessions.length - maxVisible));
  const visible = sessions.slice(start, start + maxVisible);

  const idW = 8; // short UUID prefix
  const selW = isFilterActive ? 4 : 0;
  const slugW = Math.max(30, Math.floor((termWidth - 30 - idW - 3 - selW) * 0.75)) - (isFilterActive ? 4 : 0);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Box>
          <Text color="cyan" bold> CSM - Sessions: </Text>
          <Text color="white">{projectPath.replace(/^\/Users\/[^/]+/, '~')}</Text>
          <Text color={source === 'codex' ? 'yellow' : 'green'}> [{source === 'codex' ? 'Codex' : 'Claude'}]</Text>
        </Box>

        {/* Header */}
        <Box>
          <Text color="gray" bold>{'  # '}</Text>
          {isFilterActive && <Text color="gray" bold>{'    '}</Text>}
          <Text color="gray" bold>{'│'}</Text>
          <Text color="gray" bold>{' ' + 'ID'.padEnd(idW) + ' '}</Text>
          <Text color="gray" bold>{'│'}</Text>
          <Text color="gray" bold>{' ' + 'Slug'.padEnd(slugW) + ' '}</Text>
          <Text color="gray" bold>{'│'}</Text>
          <Text color="gray" bold>{' ' + 'Date'.padEnd(10) + ' '}</Text>
          <Text color="gray" bold>{'│'}</Text>
          <Text color="gray" bold>{' ' + 'Msgs'.padStart(4) + ' │'}</Text>
          <Text color="green" bold>{' ' + '↑in'.padStart(5) + ' '}</Text>
          <Text color="gray" bold>{'│'}</Text>
          <Text color="yellow" bold>{' ' + '↓out'.padStart(5) + ' '}</Text>
        </Box>
        <Box>
          <Text color="gray">{'─'.repeat(termWidth - 4)}</Text>
        </Box>

        {sessions.length === 0 ? (
          <Box paddingY={1}>
            <Text color="yellow">{filterText ? '  No matching sessions' : '  No sessions found'}</Text>
          </Box>
        ) : (
          visible.map((s, i) => {
            const globalIdx = start + i;
            const isSelected = globalIdx === selectedIndex;
            const bg = isSelected ? 'blue' : undefined;
            const fg = isSelected ? 'white' : 'white';

            const previewLen = termWidth - 8;
            const preview = s.firstMessage
              ? (s.firstMessage.length > previewLen ? s.firstMessage.slice(0, previewLen - 1) + '…' : s.firstMessage)
              : '';

            return (
              <Box key={s.id || s.filePath} flexDirection="column">
              <Box>
                <Text color={isSelected ? 'yellow' : 'gray'} bold={isSelected}>
                  {isSelected ? '>' : ' '}{String(globalIdx + 1).padStart(2)}{' '}
                </Text>
                {isFilterActive && (
                  <Text color={selectedIds.has(s.id) ? 'green' : 'gray'}>
                    {selectedIds.has(s.id) ? '[x] ' : '[ ] '}
                  </Text>
                )}
                <Text color="gray">{'│'}</Text>
                <Text color={isSelected ? 'gray' : 'gray'} backgroundColor={bg}>
                  {' ' + s.id.slice(0, idW) + ' '}
                </Text>
                <Text color="gray">{'│'}</Text>
                <Text color={fg} backgroundColor={bg}>
                  {' ' + truncate(s.slug, slugW) + ' '}
                </Text>
                <Text color="gray">{'│'}</Text>
                <Text color={isSelected ? 'green' : 'white'} backgroundColor={bg}>
                  {' ' + formatDate(s.lastModified) + ' '}
                </Text>
                <Text color="gray">{'│'}</Text>
                <Text color={isSelected ? 'yellow' : 'white'} backgroundColor={bg}>
                  {' ' + String(s.messageCount).padStart(4) + ' │'}
                </Text>
                <Text color={isSelected ? 'green' : 'green'} backgroundColor={bg}>
                  {' ' + formatTokens(s.inputTokens) + ' '}
                </Text>
                <Text color="gray">{'│'}</Text>
                <Text color={isSelected ? 'yellow' : 'yellow'} backgroundColor={bg}>
                  {' ' + formatTokens(s.outputTokens) + ' '}
                </Text>
              </Box>
              {expandedIds.has(s.id) && preview ? (
                <Box paddingLeft={4}>
                  <Text color="gray">{preview}</Text>
                </Box>
              ) : null}
              </Box>
            );
          })
        )}
      </Box>

      {isFiltering && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text color="cyan">Filter: </Text>
          <Text>{filterText}</Text>
          <Text color="gray">█</Text>
        </Box>
      )}

      {sessions.length > 0 && (
        <Box paddingLeft={1}>
          <Text color="gray">
            {`${sessions.length} session${sessions.length !== 1 ? 's' : ''}${filterText ? ' (filtered)' : ''}`}
          </Text>
        </Box>
      )}
    </Box>
  );
}
