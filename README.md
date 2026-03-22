<div align="center">

# shadcn-registry-mcp

**The missing bridge between your AI assistant and your UI component library.**

[![npm version](https://img.shields.io/npm/v/shadcn-registry-mcp?color=black&style=flat-square)](https://www.npmjs.com/package/shadcn-registry-mcp)
[![license](https://img.shields.io/github/license/Rachidhssin/shadcn-registry-mcp?color=black&style=flat-square)](LICENSE)
[![tests](https://img.shields.io/badge/tests-12%20passing-brightgreen?style=flat-square)](tests/)
[![typescript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-purple?style=flat-square)](https://modelcontextprotocol.io)

Stop copy-pasting install commands. Tell your AI to add a component — and it just appears.

</div>

---

## The problem

You're building with an AI assistant. You ask for a `<Dialog>` component. The AI writes the code, then tells you to run:

```bash
npx shadcn@latest add dialog
```

You switch to a terminal, run the command, switch back. Every. Single. Time.

**shadcn-registry-mcp** eliminates that context switch entirely. Your AI assistant gains the ability to install, inspect, and manage shadcn/ui components directly — without ever leaving the conversation.

---

## What it does

```
You:  "Add a sidebar with navigation to my project"

AI:   ✓ Fetched sidebar from registry (7 dependencies)
      ✓ Installed: sidebar, button, separator, sheet, tooltip, input, skeleton
      ✓ Wrote 8 files to src/components/ui/
      ✓ Added 12 CSS variables to globals.css
      ✓ Installed 4 npm packages via pnpm

      Done. Import from @/components/ui/sidebar.
```

No terminal. No copy-paste. No broken dependencies.

---

## Features

| | |
|---|---|
| **Smart dependency resolution** | Recursively resolves the full tree — installs deps before the component that needs them |
| **Dry-run mode** | Preview exactly what will be written before committing a single change |
| **Duplicate detection** | Skips already-installed components and tells you clearly which were new vs. existing |
| **Framework detection** | Auto-detects Next.js App Router, Pages Router, Vite, or plain React |
| **Package manager aware** | Detects and uses npm, pnpm, yarn, or bun automatically from your lockfile |
| **CSS variable merging** | Injects component CSS vars into your `globals.css` — idempotently, no duplicates |
| **Rich install reports** | Every file written, every package installed, exact paths — nothing hidden |

---

## Quick Start

**1. Make sure your project is initialized with shadcn:**

```bash
npx shadcn@latest init
```

**2. Add the MCP server to your AI client:**

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "shadcn-registry-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add shadcn -- npx -y shadcn-registry-mcp
```

Or manually in `.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "shadcn-registry-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor / other MCP clients</strong></summary>

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "shadcn-registry-mcp"]
    }
  }
}
```

</details>

**3. Restart your AI client and start asking for components.**

---

## Tools

The server exposes 6 tools your AI assistant can call:

### `add_component`
> Install one or more components with full dependency resolution.

```
names    string[]   Components to install, e.g. ["dialog", "button"]
dryRun   boolean    Preview changes without writing anything (default: false)
```

### `get_component_info`
> Deep-dive on a component before installing — files, deps, CSS vars, and whether it's already in your project.

```
name     string     Component name, e.g. "sidebar", "data-table"
```

### `list_components`
> Browse everything available in the official registry.

```
category string?    Optional filter, e.g. "form", "layout"
```

### `search_components`
> Find components by name or keyword, ranked by relevance.

```
query    string     Search term
```

### `list_installed`
> See which shadcn components are already in your project.

```
(no arguments)
```

### `detect_project`
> Inspect how the server sees your project — framework, paths, package manager, config.

```
(no arguments)
```

---

## Example flows

**Installing a complex component:**
```
You:  "I need a data table with sorting"

AI calls: get_component_info("table")
          → 2 registry deps, 1 npm package, not yet installed

AI calls: add_component({ names: ["table"], dryRun: true })
          → Shows exactly what will be written

AI calls: add_component({ names: ["table"] })
          → Installed. Here's your import.
```

**Auditing your project:**
```
You:  "What shadcn components do we already have?"

AI calls: list_installed
          → ✓ button   src/components/ui/button.tsx
            ✓ dialog   src/components/ui/dialog.tsx
            ✓ input    src/components/ui/input.tsx
            ... 12 components total
```

---

## Security

The 2026 AI ecosystem has a supply chain problem. Malicious MCP packages disguise themselves as developer tools to steal credentials, SSH keys, and browser sessions.

This server is built with that threat model in mind:

**Network egress is locked.** Every outbound request is validated before execution. The only permitted host is `https://ui.shadcn.com`. Any attempt to contact another domain — whether from registry data or tool input — raises a `SecurityError` and aborts immediately.

**No path traversal.** Every file path from the registry is resolved against your project root via `path.resolve()` and explicitly rejected if it escapes the boundary. `../` sequences are blocked at both the string and resolved-path level.

**No shell injection.** Package manager commands use `execFile()` with arguments as arrays — never string concatenation into `exec()`. Registry-supplied package names cannot inject shell commands.

**No sensitive file access.** The server reads only `components.json`, `package.json`, and the directories those files reference. It never touches `.env`, SSH keys, credential files, or your home directory.

**Zero stdout logging.** The stdio transport uses stdout as the JSON-RPC channel. All server logging goes to `stderr` exclusively. A single stray `console.log()` would corrupt the protocol — this server has none.

**Minimal dependencies.** The entire server runs on `@modelcontextprotocol/sdk` and `zod`. No extra packages means a smaller attack surface and a faster `npx` cold-start.

---

## Architecture

```
src/
├── index.ts              Entry point — stdio transport, startup
├── server.ts             MCP server, all 6 tools registered with Zod schemas
├── types.ts              Shared interfaces + typed error classes
│
├── tools/                One handler per tool — thin, composable
│   ├── add-component.ts
│   ├── detect-project.ts
│   ├── get-component-info.ts
│   ├── list-components.ts
│   ├── list-installed.ts
│   └── search-components.ts
│
├── registry/
│   ├── client.ts         HTTPS-only fetch, host whitelist, 5-min index cache
│   └── resolver.ts       Recursive dep tree, cycle detection, depth limit
│
├── project/
│   ├── analyzer.ts       Walks up to components.json, framework + pkg manager detection
│   └── scanner.ts        Checks installed components by scanning dirs
│
└── writer/
    ├── file-writer.ts    Path-validated file writes, dry-run support
    ├── css-writer.ts     Idempotent CSS variable merging
    └── pkg-installer.ts  execFile-based package installation
```

---

## Development

```bash
git clone https://github.com/Rachidhssin/shadcn-registry-mcp
cd shadcn-registry-mcp
npm install

npm run dev        # Run with tsx (no build step)
npm run build      # Compile to dist/
npm test           # Run 12 tests with vitest
npm run test:watch # Watch mode
```

---

## Contributing

1. Fork and create a branch: `git checkout -b feat/your-feature`
2. Make changes with tests
3. Confirm `npm test` and `npm run build` both pass cleanly
4. Open a pull request

All security properties must be preserved. New network destinations, file paths, or shell invocations require explicit justification.

---

<div align="center">

MIT License · Built with [MCP SDK](https://modelcontextprotocol.io) · Powered by the [shadcn/ui registry](https://ui.shadcn.com)

</div>
