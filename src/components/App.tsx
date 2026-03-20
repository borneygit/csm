import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ProjectView } from './ProjectView.tsx';
import { ListView } from './ListView.tsx';
import { DetailView } from './DetailView.tsx';
import { StatusBar } from './StatusBar.tsx';
import type { ProjectMeta, SessionMeta, SessionDetail, ViewMode } from '../types.ts';
import type { IProvider } from '../providers/IProvider.ts';

interface AppProps {
  provider: IProvider;
  source: 'claude' | 'codex';
}

export function App({ provider, source }: AppProps) {
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
    const loaded = provider.scanProjects();
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
    const loaded = provider.scanProject(project.dirName);
    setAllSessions(loaded);
    setSessions(loaded);
    setSessionIndex(0);
    setFilterText('');
    setIsFiltering(false);
    setView('list');
  }, [projects, projectIndex, provider]);

  const handleEnterSession = useCallback(() => {
    if (sessions.length === 0) return;
    const session = sessions[sessionIndex];
    if (!session) return;
    const d = provider.getDetail(session.filePath);
    setDetail(d);
    setView('detail');
  }, [sessions, sessionIndex, provider]);

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
      provider.renameSession(detail, newSlug);
      setDetail(prev => prev ? { ...prev, slug: newSlug } : prev);
      setAllSessions(prev => prev.map(s => s.id === detail.id ? { ...s, slug: newSlug } : s));
      setStatusMessage(`Renamed to: ${newSlug}`);
      setTimeout(() => setStatusMessage(''), 2000);
    } catch (e) {
      setStatusMessage(`Rename failed: ${e}`);
      setTimeout(() => setStatusMessage(''), 2000);
    }
  }, [detail, provider]);

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
    try {
      provider.deleteProject(project);
      setStatusMessage(`Deleted project: ${project.path}`);
    } catch (e) {
      setStatusMessage(`Delete failed: ${e}`);
    }
    const newProjects = projects.filter((_, i) => i !== projectIndex);
    setProjects(newProjects);
    setProjectIndex(prev => Math.max(0, Math.min(prev, newProjects.length - 1)));
    setConfirmDelete(false);
    setTimeout(() => setStatusMessage(''), 2000);
  }, [projects, projectIndex, provider]);

  const handleDeleteConfirm = useCallback(() => {
    // Batch delete in filter state
    if (isFilterActive && selectedIds.size > 0) {
      const count = selectedIds.size;
      for (const id of selectedIds) {
        const s = allSessions.find(x => x.id === id);
        if (s) try { provider.deleteSession(s); } catch {}
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
      provider.deleteSession(session);
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
  }, [sessions, sessionIndex, view, detail, allSessions, isFilterActive, selectedIds, provider]);

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
          source={source}
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
          source={source}
        />
      )}

      {view === 'detail' && (
        detail
          ? <DetailView
              detail={detail}
              source={source}
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
