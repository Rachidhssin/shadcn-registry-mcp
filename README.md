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

### Your AI shouldn't need a terminal.

`shadcn-registry-mcp` is a secure MCP server that gives AI coding assistants (Claude, Cursor, Windsurf, and more) direct access to the shadcn/ui registry — fetching, installing, and wiring up components without a single context switch.

</div>

---

## What it does

You talk to your AI. Your AI talks to this server. The server handles everything else.

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

## Why this exists

**AI-generated UI tends to be generic.** When your AI guesses at component structure instead of reading from the actual registry, you get inconsistent code that fights your design system.

**Public MCP registries are a security risk.** The MCP ecosystem is actively targeted by supply-chain attacks — malicious servers that disguise themselves as developer tools to exfiltrate SSH keys, tokens, and environment variables.

This server solves both:

- **Accurate installs** — components come directly from the official `ui.shadcn.com` registry, with the exact file structure, dependency tree, and CSS variables shadcn intends. No guessing.
- **Conversational flow** — ask for a data table, a sidebar, or an entire form kit. The server resolves transitive deps, writes all files, and runs your package manager. You stay in the conversation.
- **Codebase-safe** — the server reads your `components.json` to understand your exact project layout before writing a single file. It integrates with your structure, not against it.
- **Security-hardened** — network egress is locked to `ui.shadcn.com` only. Path traversal is blocked. Package installs use `execFile()`, never shell concatenation. Your environment stays yours.

---

## Who is this for

Frontend and full-stack developers who use shadcn/ui and want their AI assistant to actually install components correctly — with full dependency resolution, proper file placement, and zero security compromises.

If you've ever had an AI tell you to "run `npx shadcn@latest add button`" mid-conversation, this is for you.

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

Eight tools are exposed to your AI assistant:

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

## Security

The MCP ecosystem has a supply-chain problem. Malicious servers disguise themselves as developer tools to steal credentials, SSH keys, and environment secrets. This server is built with that threat model in mind:

| Control | What it prevents |
|---|---|
| **Network egress locked to `ui.shadcn.com`** | Registry data or tool inputs cannot trigger requests to attacker-controlled domains |
| **Path traversal prevention** | Registry-supplied paths are validated and resolved against the project root — no `../../.ssh` escapes |
| **No shell injection** | `execFile()` with a typed args array; package names from the registry cannot inject shell commands |
| **No stdout pollution** | All logging goes to `stderr`; the stdio JSON-RPC channel is never corrupted |
| **Minimal filesystem scope** | Reads only `components.json`, `package.json`, and their referenced directories |
| **Zod input validation** | Every tool input is schema-validated before any code runs |

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

Or via env var (useful in CI):

```json
{ "env": { "SHADCN_REGISTRY_URL": "https://registry.company.com/r" } }
```

Custom registry is checked first; the official shadcn registry is the fallback — internal and standard components work side by side.

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
npm test             # Run 42 tests (unit + E2E)
npm run test:watch   # Watch mode
npm run pack:bundle  # Build + create shadcn-registry-mcp.mcpb bundle
```

---

## Contributing

Contributions are welcome and appreciated. Here's how to get involved:

1. **Star the repo** — if this saves you time, a star helps others find it and keeps the project going.
2. **Report issues** — found a bug or a component that doesn't install correctly? [Open an issue](https://github.com/Rachidhssin/shadcn-registry-mcp/issues).
3. **Submit a PR** — fork → branch → write tests → open a PR. Both `npm test` and `npm run build` must pass cleanly.
4. **Suggest features** — have an idea for a new tool or integration? Start a discussion in the issues tab.

> **Security note:** All security properties (network egress locking, path validation, shell safety) must be preserved in every PR. New network destinations, filesystem paths, or shell invocations require explicit justification in the PR description.

---

<div align="center">

If this project helped you, consider giving it a ⭐ — it means a lot.

<br/>

MIT &nbsp;·&nbsp; Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) &nbsp;·&nbsp; Powered by the [shadcn/ui registry](https://ui.shadcn.com)

</div>
