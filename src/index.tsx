import React from 'react';
import { render } from 'ink';
import { App } from './components/App.tsx';
import { createProvider } from './providers/index.ts';

// Parse --path and --source arguments
const args = process.argv.slice(2);

let claudeDir: string | undefined;
const pathIdx = args.indexOf('--path');
if (pathIdx !== -1 && args[pathIdx + 1]) {
  claudeDir = args[pathIdx + 1];
}

const sourceIdx = args.indexOf('--source');
const source = (sourceIdx !== -1 ? args[sourceIdx + 1] : 'claude') as 'claude' | 'codex';

const provider = createProvider(source, claudeDir);

render(<App provider={provider} source={source} />);
