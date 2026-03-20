import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ProjectMeta } from '../types.ts';

interface ProjectViewProps {
  projects: ProjectMeta[];
  selectedIndex: number;
  source: 'claude' | 'codex';
  onSelect: (index: number) => void;
  onEnter: () => void;
  onDelete: () => void;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function shortenPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s.padEnd(maxLen);
  return '…' + s.slice(-(maxLen - 1));
}

export function ProjectView({ projects, selectedIndex, source, onSelect, onEnter, onDelete }: ProjectViewProps) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 100;

  useInput((input, key) => {
    if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
    else if (key.downArrow) onSelect(Math.min(projects.length - 1, selectedIndex + 1));
    else if (key.return) onEnter();
    else if (input === 'd') onDelete();
  });

  const maxVisible = Math.max(5, (stdout?.rows || 24) - 8);
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), projects.length - maxVisible));
  const visible = projects.slice(start, start + maxVisible);

  const pathW = Math.max(20, termWidth - 44);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Box>
          <Text color="cyan" bold> CSM - Session Manager </Text>
          <Text color={source === 'codex' ? 'yellow' : 'green'}>[{source === 'codex' ? 'Codex' : 'Claude'}]</Text>
        </Box>

        {/* Header */}
        <Box>
          <Text color="gray" bold>{'  # │ '}</Text>
          <Text color="gray" bold>{'Project'.padEnd(pathW)}</Text>
          <Text color="gray" bold>{' │ ' + 'Sessions'.padStart(8) + ' │ ' + 'Size'.padStart(7) + ' │ Date'}</Text>
        </Box>
        <Box>
          <Text color="gray">{'─'.repeat(termWidth - 4)}</Text>
        </Box>

        {projects.length === 0 ? (
          <Box paddingY={1}>
            <Text color="yellow">  No projects found</Text>
          </Box>
        ) : (
          visible.map((p, i) => {
            const globalIdx = start + i;
            const isSelected = globalIdx === selectedIndex;
            const bg = isSelected ? 'blue' : undefined;
            const short = shortenPath(p.path);

            return (
              <Box key={p.path}>
                <Text color={isSelected ? 'yellow' : 'gray'} bold={isSelected}>
                  {isSelected ? '>' : ' '}{String(globalIdx + 1).padStart(2)}{' '}
                </Text>
                <Text color="gray">{'│ '}</Text>
                <Text color={isSelected ? 'white' : 'white'} backgroundColor={bg}>
                  {truncate(short, pathW)}
                </Text>
                <Text color="gray">{' │ '}</Text>
                <Text color={isSelected ? 'yellow' : 'white'} backgroundColor={bg}>
                  {String(p.sessionCount).padStart(8)}
                </Text>
                <Text color="gray">{' │ '}</Text>
                <Text color={isSelected ? 'magenta' : 'gray'} backgroundColor={bg}>
                  {formatSize(p.totalSize).padStart(7)}
                </Text>
                <Text color="gray">{' │ '}</Text>
                <Text color={isSelected ? 'green' : 'white'} backgroundColor={bg}>
                  {formatDate(p.lastModified)}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box paddingLeft={1}>
        <Text color="gray">{`${projects.length} project${projects.length !== 1 ? 's' : ''}`}</Text>
      </Box>
    </Box>
  );
}
