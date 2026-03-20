import React from 'react';
import { render } from 'ink';
import { App } from './components/App.tsx';
import { createProvider } from './providers/index.ts';

const VERSION = '1.1.0';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(`csm v${VERSION}`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`csm v${VERSION} — Terminal UI for browsing and managing AI sessions

Usage:
  csm [options]

Options:
  --source <claude|codex>  Session provider (default: claude)
  --path <dir>             Custom projects directory
                             claude: default ~/.claude/projects
                             codex:  default ~/.codex
  --version, -v            Print version and exit
  --help, -h               Print this help and exit

Key bindings:
  ↑ ↓ / Enter              Navigate / open
  q / Esc                  Quit / go back
  d                        Delete (prompts confirmation)
  /                        Toggle search filter
  Space (filter mode)      Toggle selection
  d     (filter mode)      Delete selected sessions
  r     (detail view)      Rename session`);
  process.exit(0);
}

// Parse --path and --source arguments
let claudeDir: string | undefined;
const pathIdx = args.indexOf('--path');
if (pathIdx !== -1 && args[pathIdx + 1]) {
  claudeDir = args[pathIdx + 1];
}

const sourceIdx = args.indexOf('--source');
const source = (sourceIdx !== -1 ? args[sourceIdx + 1] : 'claude') as 'claude' | 'codex';

const provider = createProvider(source, claudeDir);

render(<App provider={provider} source={source} />);
