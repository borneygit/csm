# csm — Claude Session Manager

A terminal UI for browsing and managing [Claude Code](https://claude.ai/code) session files.

Scans `~/.claude/projects/`, lets you navigate projects and sessions, search by content, view token usage and tool calls, rename sessions, and delete what you no longer need.

## Requirements

- [Bun](https://bun.com) v1.3+

## Install & Run

```bash
bun install
bun run dev              # run directly (hot reload)
```

## Build

```bash
bun run build            # compiles to ./csm standalone binary
./csm                    # run binary
./csm --path /custom/dir # use a custom Claude projects directory
```

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

## Architecture

```
src/
├── index.tsx              # entry point, parses --path, renders App
├── components/
│   ├── App.tsx            # state, view orchestration, key bindings
│   ├── ProjectView.tsx    # project list
│   ├── ListView.tsx       # session list with filter/selection
│   ├── DetailView.tsx     # token stats, tool calls, file list, messages
│   └── StatusBar.tsx      # context-aware keyboard hints
├── scanner.ts             # scans ~/.claude/projects/, decodes dir names
├── parser.ts              # parses JSONL, extracts metadata and token counts
└── types.ts               # ProjectMeta, SessionMeta, SessionDetail
```

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) — React for CLIs
- [js-tiktoken](https://github.com/dqbd/tiktoken) — token counting (`cl100k_base`)
- [Bun](https://bun.com) — runtime and bundler
