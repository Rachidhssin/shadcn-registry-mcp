<div align="center">
  <img src="assets/logo.svg" alt="shadcn-registry-mcp" width="680" />
</div>

<br/>

<div align="center">

[![npm](https://img.shields.io/badge/npm-shadcn--registry--mcp-CB3837?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/shadcn-registry-mcp)
[![license](https://img.shields.io/github/license/Rachidhssin/shadcn-registry-mcp?style=flat-square&color=brightgreen)](LICENSE)
[![tests](https://img.shields.io/badge/tests-42%20passing-22c55e?style=flat-square&logo=vitest&logoColor=white)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-8B5CF6?style=flat-square)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)

**Your AI shouldn't need a terminal.**

`shadcn-registry-mcp` gives your AI direct access to the shadcn/ui registry —
it fetches, installs, and wires up components without a single context switch.

</div>

---

## How it feels

```
You  ──▶  "Add a sidebar with navigation to my project"

         ┌────────────────────────────────────────────────────┐
         │  1. Detects your project (Next.js App Router, pnpm)│
         │  2. Fetches sidebar from ui.shadcn.com/r/          │
         │  3. Resolves 7 registry dependencies               │
         │  4. Writes 8 files to src/components/ui/           │
         │  5. Merges 12 CSS variables → globals.css          │
         │  6. Runs pnpm add @radix-ui/react-slot ...         │
         └────────────────────────────────────────────────────┘

AI  ──▶  ✓ Done. Import from @/components/ui/sidebar.
```

No terminal. No broken deps. No copy-paste.

---

## Quick Start

**Step 1 — Initialize shadcn** *(skip if already done)*

```bash
npx shadcn@latest init
```

**Step 2 — Add the MCP server**

> **One-click:** Download `shadcn-registry-mcp.mcpb` from the [releases page](https://github.com/Rachidhssin/shadcn-registry-mcp/releases) and open it — no terminal needed.

<details>
<summary>🖥️ &nbsp;<strong>Claude Desktop</strong></summary>
<br/>

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) · `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "shadcn": { "command": "npx", "args": ["-y", "shadcn-registry-mcp"] }
  }
}
```

</details>

<details>
<summary>💻 &nbsp;<strong>Claude Code</strong></summary>
<br/>

```bash
claude mcp add shadcn -- npx -y shadcn-registry-mcp
```

</details>

<details>
<summary>🖱️ &nbsp;<strong>Cursor / Windsurf / other MCP clients</strong></summary>
<br/>

```json
{
  "mcpServers": {
    "shadcn": { "command": "npx", "args": ["-y", "shadcn-registry-mcp"] }
  }
}
```

</details>

**Step 3 — Restart your client and ask for a component.**

---

## Tools

| Tool | What it does | Writes |
|---|---|:---:|
| `detect_project` | Framework, package manager, component dirs, shadcn config | — |
| `list_components` | All available components, filterable by category | — |
| `list_groups` | Predefined groups for bulk installs | — |
| `search_components` | Find by name or keyword, ranked by relevance | — |
| `get_component_info` | Files, deps, CSS vars, install status in your project | — |
| `add_component` | Install components or groups with full dep resolution; supports `dryRun` | ✓ |
| `remove_component` | Clean uninstall — deletes component files | ✓ |
| `list_installed` | What's already in your project | — |

```ts
// Preview before writing anything
add_component({ names: ["sidebar", "button"], dryRun: true })

// Install an entire group at once
add_component({ group: "form" })  // input, textarea, select, checkbox, label, form…
```

**Groups:** `form` · `layout` · `navigation` · `overlay` · `data` · `feedback` · `typography`

---

## Compatibility

Works with **Next.js** (App + Pages Router), **Vite**, and plain React.
Auto-detects **npm**, **pnpm**, **yarn**, and **bun** from your lockfile.

| Client | Status |
|---|:---:|
| Claude Desktop | ✅ |
| Claude Code | ✅ |
| Cursor | ✅ |
| Windsurf | ✅ |
| Any MCP-compatible client | ✅ |

---

## Custom Registries

Point to an internal design system via `components.json`:

```json
{ "registryUrl": "https://registry.company.com/r" }
```

Or via env var (great for CI):

```json
{ "env": { "SHADCN_REGISTRY_URL": "https://registry.company.com/r" } }
```

Custom registry is checked first; the official shadcn registry is the fallback — standard components keep working alongside your internal ones.

---

## Security

The MCP ecosystem has a supply-chain problem. This server is built with that threat model in mind:

- **Network egress locked** — only `https://ui.shadcn.com` is permitted. Any other domain raises a `SecurityError` immediately.
- **Path traversal prevention** — every registry-supplied path is validated and resolved against the project root before any write.
- **No shell injection** — package installs use `execFile()` with a typed args array, never string concatenation.
- **No stdout pollution** — all logging goes to `stderr`. The stdio JSON-RPC channel stays clean.
- **Minimal filesystem scope** — reads only `components.json`, `package.json`, and their referenced directories. Never touches `.env` or your home dir.
- **Zod input validation** — every tool input is schema-validated before any code runs.

---

## Architecture

```
src/
├── index.ts              Entry point — stdio transport, process lifecycle
├── server.ts             McpServer — all 8 tools registered with Zod schemas
├── types.ts              Typed interfaces + error classes (SecurityError, CircularDepError…)
│
├── tools/                Thin handlers — validate input, compose modules, format output
│   ├── add-component.ts  Installs by name list or group · "did you mean?" on typos
│   ├── remove-component.ts  Uninstalls by name · path-validated deletion
│   ├── detect-project.ts
│   ├── get-component-info.ts
│   ├── list-components.ts
│   ├── list-installed.ts
│   └── search-components.ts
│
├── registry/
│   ├── client.ts         HTTPS-only fetch · host whitelist · 5-min cache · 2× retry
│   ├── resolver.ts       Recursive dep tree · cycle detection · Levenshtein suggestions
│   └── groups.ts         7 predefined groups
│
├── project/
│   ├── analyzer.ts       Walks up to components.json · framework + pkg manager detection
│   └── scanner.ts        Checks installed components by scanning configured directories
│
└── writer/
    ├── file-writer.ts    Path-validated writes · dry-run support
    ├── file-remover.ts   Path-validated deletion
    ├── css-writer.ts     Idempotent CSS variable merging
    └── pkg-installer.ts  execFile-based installs · per-package fallback

tests/
├── registry/client.test.ts       Fetch, caching, security, custom registry
├── project/analyzer.test.ts      Framework + pkg manager detection
├── writer/file-writer.test.ts    Path validation and write logic
├── writer/file-remover.test.ts   Path traversal security + deletion
└── e2e/
    ├── add-component.test.ts     Full pipeline: dry-run, install, skip, transitive deps
    ├── remove-component.test.ts  Delete, no-op, partial, multi-component
    └── detect-project.test.ts    Framework detection, alias resolution, missing config
```

---

## Development

```bash
git clone https://github.com/Rachidhssin/shadcn-registry-mcp
npm install

npm run dev          # Run with tsx — no build step needed
npm run build        # Compile TypeScript → dist/
npm test             # Run 42 tests with vitest (unit + E2E)
npm run test:watch   # Watch mode
npm run pack:bundle  # Build + create shadcn-registry-mcp.mcpb bundle
```

---

## Roadmap

- [x] Fuzzy "did you mean?" suggestions on typos
- [x] `remove_component` — clean uninstall
- [x] Component groups — install an entire category in one call
- [x] Custom registry support for internal design systems
- [x] `.mcpb` bundle for one-click install

---

## Contributing

Fork → branch → tests → PR. Both `npm test` and `npm run build` must pass.
Security properties (network egress, path validation, shell safety) must be preserved — new exceptions require explicit justification in the PR.

---

<div align="center">

MIT &nbsp;·&nbsp; Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) &nbsp;·&nbsp; Powered by the [shadcn/ui registry](https://ui.shadcn.com)

</div>
