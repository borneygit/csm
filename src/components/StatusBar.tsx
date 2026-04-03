import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  view: 'projects' | 'list' | 'detail';
  isFiltering?: boolean;
  confirmDelete?: boolean;
  isFilterActive?: boolean;
  selectedCount?: number;
  confirmDeleteLabel?: string;
  isRenaming?: boolean;
}

export function StatusBar({ view, isFiltering, confirmDelete, isFilterActive, selectedCount, confirmDeleteLabel, isRenaming }: StatusBarProps) {
  if (confirmDelete) {
    const label = confirmDeleteLabel ?? (view === 'projects' ? 'Delete this project and all its sessions?' : 'Delete this session?');
    return (
      <Box borderStyle="single" borderColor="red" paddingX={1}>
        <Text color="red" bold>{label} </Text>
        <Text color="yellow">[y] Confirm  </Text>
        <Text color="green">[N] Cancel</Text>
      </Box>
    );
  }

  if (isRenaming) {
    return (
      <Box borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="yellow">Rename: </Text>
        <Text color="white">[Enter] Confirm  [Esc] Cancel</Text>
      </Box>
    );
  }

  if (isFiltering) {
    return (
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan">Filter mode: </Text>
        <Text color="white">[Enter] Apply  [Esc] Cancel</Text>
      </Box>
    );
  }

  if (view === 'projects') {
    return (
      <Box borderStyle="single" borderColor="whiteBright" paddingX={1}>
        <Text color="cyan">[↑↓] </Text>
        <Text color="white">Navigate  </Text>
        <Text color="cyan">[Enter] </Text>
        <Text color="white">Open  </Text>
        <Text color="cyan">[d] </Text>
        <Text color="white">Delete  </Text>
        <Text color="cyan">[q/Esc] </Text>
        <Text color="white">Quit</Text>
      </Box>
    );
  }

  if (isFilterActive && view === 'list') {
    return (
      <Box borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="cyan">[↑↓] </Text><Text color="white">Navigate  </Text>
        <Text color="cyan">[Space] </Text><Text color="white">Select  </Text>
        <Text color="cyan">[d] </Text>
        <Text color="white">{selectedCount ? `Delete (${selectedCount})  ` : 'Delete  '}</Text>
        <Text color="cyan">[/] </Text><Text color="white">Re-filter  </Text>
        <Text color="cyan">[Esc] </Text><Text color="white">Clear filter  </Text>
        <Text color="cyan">[q] </Text><Text color="white">Quit</Text>
      </Box>
    );
  }

  if (view === 'list') {
    return (
      <Box borderStyle="single" borderColor="whiteBright" paddingX={1}>
        <Text color="cyan">[↑↓] </Text>
        <Text color="white">Navigate  </Text>
        <Text color="cyan">[Enter] </Text>
        <Text color="white">Detail  </Text>
        <Text color="cyan">[d] </Text>
        <Text color="white">Delete  </Text>
        <Text color="cyan">[/] </Text>
        <Text color="white">Filter  </Text>
        <Text color="cyan">[Space] </Text>
        <Text color="white">Preview  </Text>
        <Text color="cyan">[Esc/b] </Text>
        <Text color="white">Back  </Text>
        <Text color="cyan">[q] </Text>
        <Text color="white">Quit</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="whiteBright" paddingX={1}>
      <Text color="cyan">[↑↓] </Text>
      <Text color="white">Scroll  </Text>
      <Text color="cyan">[r] </Text>
      <Text color="white">Rename  </Text>
      <Text color="cyan">[d] </Text>
      <Text color="white">Delete  </Text>
      <Text color="cyan">[Esc/b] </Text>
      <Text color="white">Back</Text>
    </Box>
  );
}
