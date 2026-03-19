import * as fs from 'fs';
import * as path from 'path';
import { getEncoding } from 'js-tiktoken';
import type { SessionMeta, SessionDetail, MessagePreview } from './types.ts';

const enc = getEncoding('cl100k_base');
function countTokens(text: string): number {
  try {
    return enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

interface JsonlLine {
  uuid?: string;
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  slug?: string;
  customTitle?: string;
  version?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
  };
}

function extractText(content: string | Array<{ type: string; text?: string }> | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') {
    // slash command format: extract command name + args
    const cmdName = content.match(/<command-name>([^<]+)<\/command-name>/)?.[1] ?? '';
    const cmdArgs = content.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1]?.trim() ?? '';
    if (cmdName) return cmdArgs ? `${cmdName} ${cmdArgs}` : cmdName;
    return content;
  }
  return content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join(' ');
}

export function parseMeta(filePath: string): SessionMeta | null {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let id = '';
    let slug = '';
    let customTitle = '';
    let projectPath = '';
    let messageCount = 0;
    let firstMessage = '';
    const allTexts: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (const line of lines) {
      try {
        const obj: JsonlLine = JSON.parse(line);
        if (!id && obj.sessionId) id = obj.sessionId;
        // customTitle (from /rename) takes priority over slug
        if (!customTitle && obj.type === 'custom-title' && obj.customTitle) {
          customTitle = obj.customTitle;
        }
        if (!slug && obj.slug) slug = obj.slug;
        if (!projectPath && obj.cwd) projectPath = obj.cwd;
        if (obj.type === 'user' || obj.type === 'assistant') messageCount++;
        if (obj.type === 'user' && obj.message) {
          const text = extractText(obj.message.content as string | Array<{ type: string; text?: string }>);
          if (text.trim()) {
            if (!firstMessage) firstMessage = text.trim();
            allTexts.push(text.trim());
            inputTokens += Math.ceil(text.length / 4);
          }
        }
        if (obj.type === 'assistant' && obj.message) {
          const text = extractText(obj.message.content as string | Array<{ type: string; text?: string }>);
          if (text.trim()) outputTokens += Math.ceil(text.length / 4);
        }
      } catch {
        // skip malformed lines
      }
    }

    if (!id) id = path.basename(filePath, '.jsonl');

    // customTitle (from /rename) takes priority, fallback to slug
    const displayName = customTitle || slug || id.slice(0, 20);

    return {
      id,
      slug: displayName,
      projectPath: projectPath || '',
      filePath,
      fileSize: stat.size,
      lastModified: stat.mtime,
      messageCount,
      firstMessage,
      searchText: allTexts.join(' '),
      inputTokens,
      outputTokens,
    };
  } catch {
    return null;
  }
}

export function parseDetail(filePath: string): SessionDetail | null {
  const meta = parseMeta(filePath);
  if (!meta) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const toolCalls: Record<string, number> = {};
    const filesChangedSet = new Set<string>();
    const messages: MessagePreview[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (const line of lines) {
      try {
        const obj: JsonlLine = JSON.parse(line);

        // tool call stats
        if (obj.type === 'tool_use' && obj.message) {
          const msgContent = obj.message.content;
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block.type === 'tool_use' && block.name) {
                toolCalls[block.name] = (toolCalls[block.name] || 0) + 1;
                // extract file paths
                extractFilePaths(block.name, block.input || {}, filesChangedSet);
              }
            }
          }
        }

        // also check assistant messages for tool_use blocks
        if (obj.type === 'assistant' && obj.message) {
          const msgContent = obj.message.content;
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block.type === 'tool_use' && block.name) {
                toolCalls[block.name] = (toolCalls[block.name] || 0) + 1;
                extractFilePaths(block.name, (block as { type: string; name?: string; input?: Record<string, unknown> }).input || {}, filesChangedSet);
              }
            }
          }
        }

        // message previews
        if ((obj.type === 'user' || obj.type === 'assistant') && obj.message) {
          const text = extractText(obj.message.content as string | Array<{ type: string; text?: string }>);
          if (text.trim()) {
            const tokens = countTokens(text);
            if (obj.type === 'user') inputTokens += tokens;
            else outputTokens += tokens;
            messages.push({
              role: obj.message.role || obj.type,
              content: text,
              timestamp: obj.timestamp || '',
              tokens,
            });
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    return {
      ...meta,
      toolCalls,
      filesChanged: Array.from(filesChangedSet).slice(0, 20),
      messages: messages.slice(0, 10),
      inputTokens,
      outputTokens,
    };
  } catch {
    return null;
  }
}

function extractFilePaths(toolName: string, input: Record<string, unknown>, set: Set<string>) {
  const fileTools = ['Edit', 'Write', 'Read', 'Bash', 'NotebookEdit', 'MultiEdit'];
  if (!fileTools.includes(toolName)) return;

  const candidates = ['file_path', 'notebook_path', 'path'];
  for (const key of candidates) {
    if (typeof input[key] === 'string') {
      set.add(input[key] as string);
      return;
    }
  }

  // For Bash, try to extract file paths from command string
  if (toolName === 'Bash' && typeof input.command === 'string') {
    const cmd = input.command as string;
    const matches = cmd.match(/(?:^|\s)(\/[^\s]+)/g);
    if (matches) {
      for (const m of matches.slice(0, 3)) {
        set.add(m.trim());
      }
    }
  }
}
