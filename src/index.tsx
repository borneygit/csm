import React from 'react';
import { render } from 'ink';
import { App } from './components/App.tsx';

// Parse --path argument
const args = process.argv.slice(2);
let claudeDir: string | undefined;
const pathIdx = args.indexOf('--path');
if (pathIdx !== -1 && args[pathIdx + 1]) {
  claudeDir = args[pathIdx + 1];
}

render(<App claudeDir={claudeDir} />);
