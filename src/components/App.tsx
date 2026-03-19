import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { scanProjects, scanProject, getBaseDir } from '../scanner.ts';
import { parseDetail } from '../parser.ts';
import * as path from 'path';
import { ProjectView } from './ProjectView.tsx';
import { ListView } from './ListView.tsx';
import { DetailView } from './DetailView.tsx';
import { StatusBar } from './StatusBar.tsx';
import type { ProjectMeta, SessionMeta, SessionDetail, ViewMode } from '../types.ts';
import * as fs from 'fs';

interface AppProps {
  claudeDir?: string;
}

export function App({ claudeDir }: AppProps) {
  const { exit } = useApp();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectIndex, setProjectIndex] = useState(0);

  const [allSessions, setAllSessions] = useState<SessionMeta[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);

  const [view, setView] = useState<ViewMode>('projects');
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRenaming, setIsRenaming] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const loaded = scanProjects(claudeDir);
    setProjects(loaded);
    setLoading(false);
  }, []);

  // Filter sessions when filterText changes
  useEffect(() => {
    if (!filterText) {
      setSessions(allSessions);
      return;
    }
    const lower = filterText.toLowerCase();
    setSessions(
      allSessions.filter(s =>
        s.slug.toLowerCase().includes(lower) ||
        s.searchText.toLowerCase().includes(lower)
      )
    );
    setSessionIndex(0);
  }, [filterText, allSessions]);

  const handleEnterProject = useCallback(() => {
    const project = projects[projectIndex];
    if (!project) return;
    const loaded = scanProject(project.dirName, claudeDir);
    setAllSessions(loaded);
    setSessions(loaded);
    setSessionIndex(0);
    setFilterText('');
    setIsFiltering(false);
    setView('list');
  }, [projects, projectIndex, claudeDir]);

  const handleEnterSession = useCallback(() => {
    if (sessions.length === 0) return;
    const session = sessions[sessionIndex];
    if (!session) return;
    const d = parseDetail(session.filePath);
    setDetail(d);
    setView('detail');
  }, [sessions, sessionIndex]);

  const handleSelectionToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleClearFilter = useCallback(() => {
    setFilterText('');
    setSelectedIds(new Set());
  }, []);

  const handleBackToProjects = useCallback(() => {
    setView('projects');
    setDetail(null);
    setConfirmDelete(false);
    setFilterText('');
    setIsFiltering(false);
    setSelectedIds(new Set());
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setDetail(null);
    setConfirmDelete(false);
    setIsRenaming(false);
  }, []);

  const handleRename = useCallback((newSlug: string) => {
    if (!detail) return;
    try {
      const content = fs.readFileSync(detail.filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      // Check if any line has custom-title type
      const hasCustomTitle = lines.some(line => {
        try {
          const obj = JSON.parse(line);
          return obj.type === 'custom-title';
        } catch { return false; }
      });

      const trailing = content.endsWith('\n') ? '' : '\n';

      if (hasCustomTitle) {
        // Append a new custom-title record (same format as Claude Code's /rename)
        const newRecord = JSON.stringify({ type: 'custom-title', customTitle: newSlug, sessionId: detail.id }) + '\n';
        fs.writeFileSync(detail.filePath, content + trailing + newRecord, 'utf-8');
      } else {
        // Update slug field in the first line that has it
        let updated = false;
        const newLines = lines.map(line => {
          if (updated) return line;
          const replaced = line.replace(
            /"slug"\s*:\s*"((?:[^"\\]|\\.)*)"/,
            `"slug":${JSON.stringify(newSlug)}`
          );
          if (replaced !== line) { updated = true; return replaced; }
          return line;
        });
        if (updated) {
          fs.writeFileSync(detail.filePath, newLines.join('\n') + '\n', 'utf-8');
        } else {
          // No slug field exists — append a new line
          fs.writeFileSync(detail.filePath, content + trailing + JSON.stringify({ type: 'summary', sessionId: detail.id, slug: newSlug }) + '\n', 'utf-8');
        }
      }

      setDetail(prev => prev ? { ...prev, slug: newSlug } : prev);
      setAllSessions(prev => prev.map(s => s.id === detail.id ? { ...s, slug: newSlug } : s));
      setStatusMessage(`Renamed to: ${newSlug}`);
      setTimeout(() => setStatusMessage(''), 2000);
    } catch (e) {
      setStatusMessage(`Rename failed: ${e}`);
      setTimeout(() => setStatusMessage(''), 2000);
    }
  }, [detail]);

  const isFilterActive = filterText !== '' && !isFiltering;

  const handleDeleteRequest = useCallback(() => {
    if (view === 'projects') {
      if (projects.length === 0) return;
      setConfirmDelete(true);
    } else if (view === 'list') {
      if (sessions.length === 0) return;
      setConfirmDelete(true);
    } else if (view === 'detail') {
      if (!detail) return;
      setConfirmDelete(true);
    }
  }, [view, projects, sessions, detail]);

  const handleDeleteProjectConfirm = useCallback(() => {
    const project = projects[projectIndex];
    if (!project) return;
    const dirPath = path.join(getBaseDir(claudeDir), project.dirName);
    try {
      fs.rmSync(dirPath, { recursive: true });
      setStatusMessage(`Deleted project: ${project.path}`);
    } catch (e) {
      setStatusMessage(`Delete failed: ${e}`);
    }
    const newProjects = projects.filter((_, i) => i !== projectIndex);
    setProjects(newProjects);
    setProjectIndex(prev => Math.max(0, Math.min(prev, newProjects.length - 1)));
    setConfirmDelete(false);
    setTimeout(() => setStatusMessage(''), 2000);
  }, [projects, projectIndex, claudeDir]);

  const handleDeleteConfirm = useCallback(() => {
    // Batch delete in filter state
    if (isFilterActive && selectedIds.size > 0) {
      const count = selectedIds.size;
      for (const id of selectedIds) {
        const s = allSessions.find(x => x.id === id);
        if (s) try { fs.unlinkSync(s.filePath); } catch {}
      }
      const newAll = allSessions.filter(s => !selectedIds.has(s.id));
      setAllSessions(newAll);
      setSelectedIds(new Set());
      setConfirmDelete(false);
      setSessionIndex(0);
      setStatusMessage(`Deleted ${count} sessions`);
      setTimeout(() => setStatusMessage(''), 2000);
      return;
    }

    const session = view === 'detail' && detail ? detail : sessions[sessionIndex];
    if (!session) return;

    try {
      fs.unlinkSync(session.filePath);
      setStatusMessage(`Deleted: ${session.slug}`);
    } catch (e) {
      setStatusMessage(`Delete failed: ${e}`);
    }

    const newAll = allSessions.filter(s => s.id !== session.id);
    setAllSessions(newAll);

    // Update project session count
    setProjects(prev => prev.map(p =>
      p.path === session.projectPath
        ? { ...p, sessionCount: Math.max(0, p.sessionCount - 1) }
        : p
    ));

    if (view === 'detail') {
      setView('list');
      setDetail(null);
    }

    setConfirmDelete(false);
    setSessionIndex(prev => Math.max(0, Math.min(prev, newAll.length - 1)));
    setTimeout(() => setStatusMessage(''), 2000);
  }, [sessions, sessionIndex, view, detail, allSessions, isFilterActive, selectedIds]);

  // Global key handler
  useInput((input, key) => {
    if (confirmDelete) {
      if (input === 'y' || input === 'Y') {
        if (view === 'projects') handleDeleteProjectConfirm();
        else handleDeleteConfirm();
      } else {
        setConfirmDelete(false);
      }
      return;
    }

    if (!isFiltering && (input === 'q' || (key.escape && view === 'projects'))) {
      exit();
    }
  });

  if (loading) {
    return <Box><Text color="cyan">Loading...</Text></Box>;
  }

  const currentProject = projects[projectIndex];

  return (
    <Box flexDirection="column">
      {view === 'projects' && (
        <ProjectView
          projects={projects}
          selectedIndex={projectIndex}
          onSelect={setProjectIndex}
          onEnter={handleEnterProject}
          onDelete={handleDeleteRequest}
        />
      )}

      {view === 'list' && (
        <ListView
          sessions={sessions}
          selectedIndex={sessionIndex}
          filterText={filterText}
          isFiltering={isFiltering}
          projectPath={currentProject?.path ?? ''}
          onSelect={setSessionIndex}
          onEnter={handleEnterSession}
          onBack={handleBackToProjects}
          onDelete={handleDeleteRequest}
          onFilterChange={setFilterText}
          onFilterToggle={() => {
            if (isFiltering) {
              setIsFiltering(false);
            } else {
              setIsFiltering(true);
              setFilterText('');
              setSelectedIds(new Set());
            }
          }}
          isFilterActive={isFilterActive}
          selectedIds={selectedIds}
          onSelectionToggle={handleSelectionToggle}
          onClearFilter={handleClearFilter}
        />
      )}

      {view === 'detail' && (
        detail
          ? <DetailView
              detail={detail}
              onBack={handleBackToList}
              onDelete={handleDeleteRequest}
              onRename={handleRename}
              onRenameModeChange={setIsRenaming}
            />
          : <Box><Text color="red">Failed to load session</Text></Box>
      )}

      {statusMessage ? (
        <Box paddingLeft={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
      ) : null}

      <StatusBar
        view={view}
        isFiltering={isFiltering}
        confirmDelete={confirmDelete}
        isFilterActive={isFilterActive}
        selectedCount={selectedIds.size}
        confirmDeleteLabel={isFilterActive && selectedIds.size > 0 ? `Delete ${selectedIds.size} selected sessions?` : undefined}
        isRenaming={isRenaming}
      />
    </Box>
  );
}
