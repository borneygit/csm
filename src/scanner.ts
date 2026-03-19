import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseMeta } from './parser.ts';
import type { SessionMeta, ProjectMeta } from './types.ts';

function decodeProjectPath(dirName: string): string {
  // Claude Code encodes: '/' → '-', '.' → '-'
  // So '.claude' → '--claude', '/Users/foo/.claude' → '-Users-foo--claude'
  // Decode: '--' → '/.' first, then '-' → '/'
  return dirName.replace(/--/g, '/.').replace(/-/g, '/');
}

export function getBaseDir(claudeDir?: string): string {
  return claudeDir || path.join(os.homedir(), '.claude', 'projects');
}

function readCwdFromJsonl(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as { cwd?: string };
        if (obj.cwd) return obj.cwd;
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return '';
}

export function scanProjects(claudeDir?: string): ProjectMeta[] {
  const baseDir = getBaseDir(claudeDir);
  if (!fs.existsSync(baseDir)) return [];

  let dirNames: string[];
  try {
    dirNames = fs.readdirSync(baseDir);
  } catch {
    return [];
  }

  const projects: ProjectMeta[] = [];

  for (const dirName of dirNames) {
    const dirPath = path.join(baseDir, dirName);
    try {
      if (!fs.statSync(dirPath).isDirectory()) continue;
    } catch {
      continue;
    }

    let files: string[];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    if (jsonlFiles.length === 0) continue;

    let totalSize = 0;
    let lastModified = new Date(0);
    let newestFile = '';

    for (const file of jsonlFiles) {
      try {
        const stat = fs.statSync(path.join(dirPath, file));
        totalSize += stat.size;
        if (stat.mtime > lastModified) {
          lastModified = stat.mtime;
          newestFile = path.join(dirPath, file);
        }
      } catch {
        // skip
      }
    }

    // prefer cwd from JSONL (accurate), fall back to decoded dir name
    const cwdFromFile = newestFile ? readCwdFromJsonl(newestFile) : '';
    const projectPath = cwdFromFile || decodeProjectPath(dirName);

    projects.push({
      path: projectPath,
      dirName,
      sessionCount: jsonlFiles.length,
      totalSize,
      lastModified,
    });
  }

  projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return projects;
}

export function scanProject(dirName: string, claudeDir?: string): SessionMeta[] {
  const baseDir = getBaseDir(claudeDir);
  const dirPath = path.join(baseDir, dirName);

  if (!fs.existsSync(dirPath)) return [];

  let files: string[];
  try {
    files = fs.readdirSync(dirPath);
  } catch {
    return [];
  }

  const sessions: SessionMeta[] = [];
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    const meta = parseMeta(path.join(dirPath, file));
    if (meta) {
      if (!meta.projectPath) meta.projectPath = decodeProjectPath(dirName);
      sessions.push(meta);
    }
  }

  sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return sessions;
}
