import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ProjectMeta, SessionMeta, SessionDetail, MessagePreview } from '../types.ts';
import type { IProvider } from './IProvider.ts';

interface IndexEntry {
  id: string;
  thread_name: string;
  updated_at: string;
}

function getCodexDir(customDir?: string): string {
  return customDir || path.join(os.homedir(), '.codex');
}

function encodeProjectId(cwd: string): string {
  return Buffer.from(cwd).toString('base64url');
}

function decodeProjectId(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf-8');
}

function extractUuidFromFilename(filePath: string): string {
  const name = path.basename(filePath, '.jsonl');
  // rollout-<ISO>-<uuid> — UUID is the last segment after the last '-' that looks like a UUID
  const uuidMatch = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuidMatch?.[1]) return uuidMatch[1];
  return name;
}

function readFirstLine(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { return JSON.parse(trimmed); } catch { return null; }
    }
  } catch {}
  return null;
}

function walkJsonlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkJsonlFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

export class CodexProvider implements IProvider {
  private indexPath: string;
  private sessionsDir: string;
  private index: Map<string, IndexEntry>;

  constructor(private codexDir?: string) {
    const base = getCodexDir(codexDir);
    this.indexPath = path.join(base, 'session_index.jsonl');
    this.sessionsDir = path.join(base, 'sessions');
    this.index = this.loadIndex();
  }

  private loadIndex(): Map<string, IndexEntry> {
    const map = new Map<string, IndexEntry>();
    if (!fs.existsSync(this.indexPath)) return map;
    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed) as IndexEntry;
          if (entry.id) map.set(entry.id, entry);
        } catch {}
      }
    } catch {}
    return map;
  }

  private writeIndex(entries: IndexEntry[]): void {
    const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(this.indexPath, content, 'utf-8');
  }

  private getCwd(filePath: string): string {
    const first = readFirstLine(filePath);
    if (first && first.type === 'session_meta') {
      const payload = first.payload as Record<string, unknown> | undefined;
      if (payload && typeof payload.cwd === 'string') return payload.cwd;
    }
    return '';
  }

  scanProjects(): ProjectMeta[] {
    const files = walkJsonlFiles(this.sessionsDir);
    const projectMap = new Map<string, { cwd: string; files: string[]; lastModified: Date; totalSize: number }>();

    for (const filePath of files) {
      const cwd = this.getCwd(filePath) || '(unknown)';
      const projectId = encodeProjectId(cwd);
      let stat: fs.Stats;
      try { stat = fs.statSync(filePath); } catch { continue; }

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { cwd, files: [], lastModified: new Date(0), totalSize: 0 });
      }
      const proj = projectMap.get(projectId)!;
      proj.files.push(filePath);
      proj.totalSize += stat.size;
      if (stat.mtime > proj.lastModified) proj.lastModified = stat.mtime;
    }

    const result: ProjectMeta[] = [];
    for (const [projectId, info] of projectMap) {
      result.push({
        path: info.cwd,
        dirName: projectId,
        sessionCount: info.files.length,
        totalSize: info.totalSize,
        lastModified: info.lastModified,
        source: 'codex',
      });
    }
    result.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    return result;
  }

  scanProject(projectId: string): SessionMeta[] {
    const cwd = decodeProjectId(projectId);
    const files = walkJsonlFiles(this.sessionsDir);
    const sessions: SessionMeta[] = [];

    for (const filePath of files) {
      const fileCwd = this.getCwd(filePath) || '(unknown)';
      if (fileCwd !== cwd) continue;
      const meta = this.parseCodexMeta(filePath);
      if (meta) sessions.push(meta);
    }

    sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    return sessions;
  }

  private parseCodexMeta(filePath: string): SessionMeta | null {
    try {
      const stat = fs.statSync(filePath);
      const id = extractUuidFromFilename(filePath);
      const indexEntry = this.index.get(id);
      const slug = indexEntry?.thread_name || id.slice(0, 20);

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      let projectPath = '';
      let messageCount = 0;
      let firstMessage = '';
      const allTexts: string[] = [];
      let inputTokens = 0;
      let outputTokens = 0;

      for (const line of lines) {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;
          if (obj.type === 'session_meta') {
            const payload = obj.payload as Record<string, unknown> | undefined;
            if (payload && typeof payload.cwd === 'string') projectPath = payload.cwd;
          }
          if (obj.type === 'event_msg') {
            const payload = obj.payload as Record<string, unknown> | undefined;
            if (!payload) continue;
            const evType = payload.type as string | undefined;
            if (evType === 'user_message') {
              messageCount++;
              const msg = typeof payload.message === 'string' ? payload.message : '';
              if (msg.trim()) {
                if (!firstMessage) firstMessage = msg.trim();
                allTexts.push(msg.trim());
                inputTokens += Math.ceil(msg.length / 4);
              }
            } else if (evType === 'agent_message' && payload.phase === 'final_answer') {
              const msg = typeof payload.message === 'string' ? payload.message : '';
              if (msg.trim()) outputTokens += Math.ceil(msg.length / 4);
            }
          }
        } catch {}
      }

      return {
        id,
        slug,
        projectPath: projectPath || '(unknown)',
        filePath,
        fileSize: stat.size,
        lastModified: stat.mtime,
        messageCount,
        firstMessage,
        searchText: allTexts.join(' '),
        inputTokens,
        outputTokens,
        source: 'codex',
      };
    } catch {
      return null;
    }
  }

  getDetail(filePath: string): SessionDetail | null {
    const meta = this.parseCodexMeta(filePath);
    if (!meta) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      const toolCalls: Record<string, number> = {};
      const messages: MessagePreview[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let lastTokenCount: { input?: number; output?: number; total?: number } | null = null;

      for (const line of lines) {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;

          if (obj.type === 'response_item') {
            const payload = obj.payload as Record<string, unknown> | undefined;
            if (payload && payload.type === 'function_call' && typeof payload.name === 'string') {
              toolCalls[payload.name] = (toolCalls[payload.name] || 0) + 1;
            }
          }

          if (obj.type === 'event_msg') {
            const payload = obj.payload as Record<string, unknown> | undefined;
            if (!payload) continue;
            const evType = payload.type as string | undefined;
            const timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : '';

            if (evType === 'user_message') {
              const msg = typeof payload.message === 'string' ? payload.message : '';
              if (msg.trim() && messages.length < 10) {
                const tokens = Math.ceil(msg.length / 4);
                inputTokens += tokens;
                messages.push({ role: 'user', content: msg.trim(), timestamp, tokens });
              }
            } else if (evType === 'agent_message' && payload.phase === 'final_answer') {
              const msg = typeof payload.message === 'string' ? payload.message : '';
              if (msg.trim() && messages.length < 10) {
                const tokens = Math.ceil(msg.length / 4);
                outputTokens += tokens;
                messages.push({ role: 'assistant', content: msg.trim(), timestamp, tokens });
              }
            } else if (evType === 'token_count') {
              const usage = payload.total_token_usage as Record<string, number> | undefined;
              if (usage) {
                lastTokenCount = {
                  input: usage.input_tokens,
                  output: usage.output_tokens,
                  total: usage.total_tokens,
                };
              }
            }
          }
        } catch {}
      }

      // Use accurate token counts from token_count events if available
      if (lastTokenCount) {
        if (lastTokenCount.input != null) inputTokens = lastTokenCount.input;
        if (lastTokenCount.output != null) outputTokens = lastTokenCount.output;
      }

      return {
        ...meta,
        toolCalls,
        filesChanged: [],
        messages,
        inputTokens,
        outputTokens,
      };
    } catch {
      return null;
    }
  }

  deleteSession(session: SessionMeta): void {
    fs.unlinkSync(session.filePath);
    const entries = Array.from(this.index.values()).filter(e => e.id !== session.id);
    this.index.delete(session.id);
    this.writeIndex(entries);
  }

  deleteProject(project: ProjectMeta): void {
    const sessions = this.scanProject(project.dirName);
    for (const session of sessions) {
      try { this.deleteSession(session); } catch {}
    }
  }

  renameSession(session: SessionDetail, newName: string): void {
    const entries = Array.from(this.index.values()).map(e =>
      e.id === session.id ? { ...e, thread_name: newName } : e
    );
    if (!this.index.has(session.id)) {
      entries.push({ id: session.id, thread_name: newName, updated_at: new Date().toISOString() });
    }
    this.index.set(session.id, { ...(this.index.get(session.id) ?? { id: session.id, updated_at: new Date().toISOString() }), thread_name: newName });
    this.writeIndex(entries);
  }
}
