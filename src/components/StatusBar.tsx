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
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">[↑↓] </Text>
        <Text>Navigate  </Text>
        <Text color="cyan">[Enter] </Text>
        <Text>Open  </Text>
        <Text color="cyan">[d] </Text>
        <Text>Delete  </Text>
        <Text color="cyan">[q/Esc] </Text>
        <Text>Quit</Text>
      </Box>
    );
  }

  if (isFilterActive && view === 'list') {
    return (
      <Box borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="cyan">[↑↓] </Text><Text>Navigate  </Text>
        <Text color="cyan">[Space] </Text><Text>Select  </Text>
        <Text color="cyan">[d] </Text>
        <Text>{selectedCount ? `Delete (${selectedCount})  ` : 'Delete  '}</Text>
        <Text color="cyan">[/] </Text><Text>Re-filter  </Text>
        <Text color="cyan">[Esc] </Text><Text>Clear filter  </Text>
        <Text color="cyan">[q] </Text><Text>Quit</Text>
      </Box>
    );
  }

  if (view === 'list') {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">[↑↓] </Text>
        <Text>Navigate  </Text>
        <Text color="cyan">[Enter] </Text>
        <Text>Detail  </Text>
        <Text color="cyan">[d] </Text>
        <Text>Delete  </Text>
        <Text color="cyan">[/] </Text>
        <Text>Filter  </Text>
        <Text color="cyan">[Space] </Text>
        <Text>Preview  </Text>
        <Text color="cyan">[Esc/b] </Text>
        <Text>Back  </Text>
        <Text color="cyan">[q] </Text>
        <Text>Quit</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="cyan">[↑↓] </Text>
      <Text>Scroll  </Text>
      <Text color="cyan">[r] </Text>
      <Text>Rename  </Text>
      <Text color="cyan">[d] </Text>
      <Text>Delete  </Text>
      <Text color="cyan">[Esc/b] </Text>
      <Text>Back</Text>
    </Box>
  );
}
