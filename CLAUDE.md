# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CSM (Claude Session Manager) is a terminal UI tool for browsing and managing Claude Code session files. It scans `~/.claude/projects/` and provides navigation, search, and management capabilities.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Run directly (no hot reload; re-run manually to pick up changes)
bun run build        # Compile to standalone binary: ./csm
./csm                # Run compiled binary
./csm --path /custom # Use custom Claude projects directory
```

## Architecture

```
src/
├── index.tsx          # Entry point, parses --path, renders App
├── components/
│   ├── App.tsx        # State management, view orchestration, key bindings
│   ├── ProjectView.tsx# Project list UI
│   ├── ListView.tsx   # Session list with filter/selection
│   ├── DetailView.tsx # Session details (tokens, tools, files, messages)
│   └── StatusBar.tsx  # Context-aware keyboard hints
├── scanner.ts         # Scans ~/.claude/projects/, decodes dir names
├── parser.ts          # Parses JSONL, extracts metadata, counts tokens
└── types.ts           # ProjectMeta, SessionMeta, SessionDetail
```

## Key Data Flow

1. **scanner.ts** reads `~/.claude/projects/` subdirectories, decodes Claude's path encoding (`/` → `-`, `.` → `--`). Decoding: `--` → `/.` first, then `-` → `/`. Also reads `cwd` from the newest JSONL file as the authoritative project path.
2. **parser.ts** reads JSONL files line-by-line, extracts: sessionId, slug/customTitle, messages, tool calls, token counts
3. **App.tsx** manages three views: `projects` → `list` → `detail`

## JSONL Format

Session files are newline-delimited JSON. Each line has a `type` field:
- `user` / `assistant`: messages with `message.role` and `message.content` (string or array of blocks)
- `tool_use`: tool invocations (also embedded in `assistant` message content blocks)
- `custom-title`: written by Claude Code's `/rename` command — `{ type, customTitle, sessionId }`. Takes priority over `slug` for display name.
- First line typically contains `sessionId`, `slug`, `cwd`

## Token Counting

- `parseMeta` (list view): rough estimate via `Math.ceil(text.length / 4)` for performance
- `parseDetail` (detail view): accurate count via `js-tiktoken` with `cl100k_base` encoding

## Display Name Priority

`customTitle` (from `custom-title` records) > `slug` > first 20 chars of `sessionId`

## DetailView Limits

- Messages: first 10 only (`messages.slice(0, 10)`)
- Files changed: first 20 only (`filesChangedSet` capped at 20)

## Key Bindings

| View | Key | Action |
|------|-----|--------|
| All | `q` / `Esc` | Quit / go back |
| Projects / List | `↑` `↓` | Navigate |
| Projects / List | `Enter` | Open |
| Projects / List | `d` | Delete (prompts confirmation) |
| List | `/` | Toggle search filter |
| List (filter) | `Space` | Toggle selection |
| List (filter) | `d` | Delete selected sessions |
| Detail | `r` | Rename session |

## stubs/

`stubs/react-devtools-core.js` is a no-op stub that prevents `ink` from attempting to load react-devtools in the compiled binary.

## Bun Conventions

- Use `bun <file>` for running TypeScript directly
- Use `bun build --compile` for binary output
- Import paths must include `.ts`/`.tsx` extensions (Bun bundler mode)
