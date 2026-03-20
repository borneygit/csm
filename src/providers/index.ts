import { ClaudeProvider } from './ClaudeProvider.ts';
import { CodexProvider } from './CodexProvider.ts';
import type { IProvider } from './IProvider.ts';

export { ClaudeProvider, CodexProvider };
export type { IProvider };

export function createProvider(source: 'claude' | 'codex', dir?: string): IProvider {
  if (source === 'codex') return new CodexProvider(dir);
  return new ClaudeProvider(dir);
}
