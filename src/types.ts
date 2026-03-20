export interface ProjectMeta {
  path: string;       // actual cwd, e.g. /Users/foo/.claude
  dirName: string;    // encoded directory name, e.g. -Users-foo--claude
  sessionCount: number;
  totalSize: number;
  lastModified: Date;
  source?: 'claude' | 'codex';
}

export interface SessionMeta {
  id: string;
  slug: string;
  projectPath: string;
  filePath: string;
  fileSize: number;
  lastModified: Date;
  messageCount: number;
  firstMessage: string;
  searchText: string;
  inputTokens: number;
  outputTokens: number;
  source?: 'claude' | 'codex';
}

export interface MessagePreview {
  role: string;
  content: string;
  timestamp: string;
  tokens: number;
}

export interface SessionDetail extends SessionMeta {
  toolCalls: Record<string, number>;
  filesChanged: string[];
  messages: MessagePreview[];
  inputTokens: number;
  outputTokens: number;
}

export type ViewMode = 'projects' | 'list' | 'detail';
