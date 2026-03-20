import * as fs from 'fs';
import * as path from 'path';
import { scanProjects, scanProject, getBaseDir } from '../scanner.ts';
import { parseDetail } from '../parser.ts';
import type { ProjectMeta, SessionMeta, SessionDetail } from '../types.ts';
import type { IProvider } from './IProvider.ts';

export class ClaudeProvider implements IProvider {
  constructor(private claudeDir?: string) {}

  scanProjects(): ProjectMeta[] {
    return scanProjects(this.claudeDir);
  }

  scanProject(dirName: string): SessionMeta[] {
    return scanProject(dirName, this.claudeDir);
  }

  getDetail(filePath: string): SessionDetail | null {
    return parseDetail(filePath);
  }

  deleteProject(project: ProjectMeta): void {
    const dirPath = path.join(getBaseDir(this.claudeDir), project.dirName);
    fs.rmSync(dirPath, { recursive: true });
  }

  deleteSession(session: SessionMeta): void {
    fs.unlinkSync(session.filePath);
  }

  renameSession(session: SessionDetail, newSlug: string): void {
    const content = fs.readFileSync(session.filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const hasCustomTitle = lines.some(line => {
      try {
        const obj = JSON.parse(line);
        return obj.type === 'custom-title';
      } catch { return false; }
    });

    const trailing = content.endsWith('\n') ? '' : '\n';

    if (hasCustomTitle) {
      const newRecord = JSON.stringify({ type: 'custom-title', customTitle: newSlug, sessionId: session.id }) + '\n';
      fs.writeFileSync(session.filePath, content + trailing + newRecord, 'utf-8');
    } else {
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
        fs.writeFileSync(session.filePath, newLines.join('\n') + '\n', 'utf-8');
      } else {
        fs.writeFileSync(session.filePath, content + trailing + JSON.stringify({ type: 'summary', sessionId: session.id, slug: newSlug }) + '\n', 'utf-8');
      }
    }
  }
}
