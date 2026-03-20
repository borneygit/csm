import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SessionDetail } from '../types.ts';

interface DetailViewProps {
  detail: SessionDetail;
  source: 'claude' | 'codex';
  onBack: () => void;
  onDelete: () => void;
  onRename: (newSlug: string) => void;
  onRenameModeChange?: (isRenaming: boolean) => void;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function DetailView({ detail, source, onBack, onDelete, onRename, onRenameModeChange }: DetailViewProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  const enterRename = () => {
    setRenameText(detail.slug);
    setIsRenaming(true);
    onRenameModeChange?.(true);
  };

  const exitRename = () => {
    setIsRenaming(false);
    onRenameModeChange?.(false);
  };

  useInput((input, key) => {
    if (isRenaming) {
      if (key.escape) { exitRename(); return; }
      if (key.return) {
        if (renameText.trim()) onRename(renameText.trim());
        exitRename();
        return;
      }
      if (key.backspace || key.delete) { setRenameText(t => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) { setRenameText(t => t + input); }
      return;
    }
    if (key.escape || input === 'b') { onBack(); }
    else if (input === 'd') { onDelete(); }
    else if (input === 'r') { enterRename(); }
  });

  const { stdout } = useStdout();
  const termWidth = (stdout?.columns || 100) - 4; // subtract border padding
  const halfW = Math.floor(termWidth / 2) - 2;

  const proj = detail.projectPath.replace(/^\/Users\/[^/]+/, '~');
  const toolEntries = Object.entries(detail.toolCalls).sort((a, b) => b[1] - a[1]);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Box>
          <Text color="cyan" bold>Session: </Text>
          {isRenaming ? (
            <>
              <Text color="yellow">{renameText}</Text>
              <Text color="gray">█</Text>
            </>
          ) : (
            <Text color="cyan" bold>{detail.slug}</Text>
          )}
          <Text color={source === 'codex' ? 'yellow' : 'green'}> [{source === 'codex' ? 'Codex' : 'Claude'}]</Text>
        </Box>

        {/* Meta */}
        <Box marginTop={0}>
          <Text color="gray">ID:       </Text>
          <Text color="gray">{detail.id}</Text>
        </Box>
        <Box>
          <Text color="gray">Project:  </Text>
          <Text color="white">{proj}</Text>
        </Box>
        <Box>
          <Text color="gray">Date:     </Text>
          <Text color="green">{formatDate(detail.lastModified)}</Text>
          <Text color="gray">  │  Messages: </Text>
          <Text color="yellow">{detail.messageCount}</Text>
          <Text color="gray">  │  Size: </Text>
          <Text color="magenta">{formatSize(detail.fileSize)}</Text>
        </Box>
        <Box>
          <Text color="gray">Tokens:   </Text>
          <Text color="green">↑ {detail.inputTokens.toLocaleString()}</Text>
          <Text color="gray"> in  </Text>
          <Text color="blue">↓ {detail.outputTokens.toLocaleString()}</Text>
          <Text color="gray"> out  </Text>
          <Text color="yellow">∑ {(detail.inputTokens + detail.outputTokens).toLocaleString()}</Text>
          <Text color="gray"> total</Text>
        </Box>

        <Text color="gray">{'─'.repeat(termWidth)}</Text>

        {/* Tool calls + Files changed */}
        <Box flexDirection="row">
          <Box flexDirection="column" width={halfW}>
            <Text color="cyan" bold>TOOL CALLS</Text>
            {toolEntries.length === 0 ? (
              <Text color="gray">  (none)</Text>
            ) : (
              toolEntries.map(([name, count]) => (
                <Box key={name}>
                  <Text color="white">  {name.padEnd(16)}</Text>
                  <Text color="yellow">×{count}</Text>
                </Box>
              ))
            )}
          </Box>

          <Box flexDirection="column" paddingX={1}>
            <Text color="gray">{'│'}</Text>
            {Array.from({ length: Math.max(toolEntries.length, detail.filesChanged.length) }).map((_, i) => (
              <Text key={i} color="gray">│</Text>
            ))}
          </Box>

          <Box flexDirection="column" width={halfW}>
            <Text color="cyan" bold>FILES CHANGED</Text>
            {detail.filesChanged.length === 0 ? (
              <Text color="gray">  (none)</Text>
            ) : (
              detail.filesChanged.map((f, i) => {
                const short = f.replace(/^\/Users\/[^/]+/, '~');
                return (
                  <Text key={i} color="white">  {short.slice(0, halfW - 2)}</Text>
                );
              })
            )}
          </Box>
        </Box>

        {/* Messages preview - hidden during rename */}
        {!isRenaming && (
          <>
            <Text color="gray">{'─'.repeat(termWidth)}</Text>
            <Text color="cyan" bold>MESSAGES PREVIEW</Text>
            {detail.messages.length === 0 ? (
              <Text color="gray">  (no messages)</Text>
            ) : (
              detail.messages.map((m, i) => {
                const roleLabel = m.role === 'user' ? '[User]' : '[Assistant]';
                const roleColor = m.role === 'user' ? 'green' : 'blue';
                return (
                  <Box key={i} flexDirection="column" marginBottom={0}>
                    <Box flexDirection="row">
                      <Text color={roleColor} bold>{roleLabel} </Text>
                      <Text color="yellow">{m.tokens} tokens  </Text>
                      <Text color="cyan">{m.timestamp ? m.timestamp.slice(0, 16).replace('T', ' ') : ''}</Text>
                    </Box>
                    <Box paddingLeft={2}>
                      <Text color="white" wrap="wrap">{m.content}</Text>
                    </Box>
                  </Box>
                );
              })
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
