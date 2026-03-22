<div align="center">
  <img src="assets/logo.svg" alt="shadcn-registry-mcp" width="100%" />
</div>

<br/>

<div align="center">

[![npm](https://img.shields.io/badge/npm-shadcn--registry--mcp-CB3837?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/shadcn-registry-mcp)
[![license](https://img.shields.io/github/license/Rachidhssin/shadcn-registry-mcp?style=flat-square&color=brightgreen)](LICENSE)
[![tests](https://img.shields.io/badge/tests-12%20passing-22c55e?style=flat-square&logo=vitest&logoColor=white)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-stdio-8B5CF6?style=flat-square)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)

</div>

---

## The Problem

You're in a conversation with your AI. You ask for a `<Sidebar>` component. The AI explains what to install, then says:

```
Run: npx shadcn@latest add sidebar
```

You open a terminal. Run the command. Wait. Switch back. Every. Single. Time.

**shadcn-registry-mcp** eliminates that context switch. Your AI gains direct access to the shadcn registry — it installs, inspects, and manages components for you, right inside the conversation.

---

## How It Works

```
You  ──▶  "Add a sidebar with navigation to my project"

         ┌────────────────────────────────────────────────────┐
         │              shadcn-registry-mcp                   │
         │                                                    │
         │  1. Detects your project (Next.js App Router, pnpm)│
         │  2. Fetches sidebar from ui.shadcn.com/r/          │
         │  3. Resolves 7 registry dependencies               │
         │  4. Writes 8 files to src/components/ui/           │
         │  5. Merges 12 CSS variables → globals.css          │
         │  6. Runs pnpm add @radix-ui/react-slot ...         │
         └────────────────────────────────────────────────────┘

AI  ──▶  ✓ Done. Import from @/components/ui/sidebar.
```

No terminal. No broken dependencies. No manual path configuration.

---

## Quick Start

**Step 1 — Initialize shadcn in your project** *(skip if already done)*

```bash
npx shadcn@latest init
```

**Step 2 — Add the MCP server to your AI client**

<details>
<summary>🖥️ &nbsp;<strong>Claude Desktop</strong></summary>
<br/>

Edit your config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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
<summary>💻 &nbsp;<strong>Claude Code</strong></summary>
<br/>

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
<summary>🖱️ &nbsp;<strong>Cursor / Windsurf / other MCP clients</strong></summary>
<br/>

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

**Step 3 — Restart your client and ask for a component.**

---

## Tools

Six tools are exposed to your AI assistant:

| Tool | Description | Writes files |
|---|---|:---:|
| `detect_project` | Inspect framework, package manager, component dirs, and shadcn config | — |
| `list_components` | Browse all available components; filter by category | — |
| `search_components` | Find components by name or keyword, ranked by relevance | — |
| `get_component_info` | Deep-dive: files, deps, CSS vars, install status in your project | — |
| `add_component` | Install components with full dependency resolution; supports `dryRun` | ✓ |
| `list_installed` | See which shadcn components are already in your project | — |

### `add_component` in detail

```ts
add_component({
  names: ["sidebar"],   // one or more component names
  dryRun: true          // preview without writing (default: false)
})
```

**Example dry-run output:**

```
DRY RUN — no files written

Would install (7):
  + sidebar
  + button
  + separator
  + sheet
  + tooltip
  + input
  + skeleton

Files that would be written (8):
  /project/src/components/ui/sidebar.tsx
  /project/src/components/ui/button.tsx
  ...

npm packages that would be installed:
  @radix-ui/react-slot
  class-variance-authority
  lucide-react
```

---

## Compatibility

### AI Clients

| Client | Setup | Status |
|---|---|:---:|
| Claude Desktop | JSON config | ✅ |
| Claude Code | CLI or JSON | ✅ |
| Cursor | JSON config | ✅ |
| Windsurf | JSON config | ✅ |
| Any MCP-compatible client | JSON config | ✅ |

### Frameworks

| Framework | How detected | Status |
|---|---|:---:|
| Next.js App Router | `src/app/` directory | ✅ |
| Next.js Pages Router | `pages/` directory | ✅ |
| Vite | `vite` in dependencies | ✅ |
| Plain React / other | Fallback | ✅ |

### Package Managers

| | npm | pnpm | yarn | bun |
|---|:---:|:---:|:---:|:---:|
| Auto-detected from lockfile | ✅ | ✅ | ✅ | ✅ |

---

## Security

> The 2026 AI ecosystem has a supply chain problem. Malicious MCP servers disguise themselves as developer tools to steal SSH keys, credentials, and browser sessions.

This server is built with that threat model in mind. Here is what it enforces:

#### 🔒 Network egress locked to one host

Every outbound HTTP request is validated before execution. The only permitted host is `https://ui.shadcn.com`. Any attempt to fetch from another domain — whether from registry data or tool input — raises a `SecurityError` immediately.

```
Attempted fetch to: https://evil.com/steal-keys
Result: SecurityError — unauthorized host
```

#### 🛡️ Path traversal prevention

Every file path received from the registry is:
1. Checked for literal `..` segments before resolution
2. Resolved against the project root via `path.resolve()`
3. Rejected if it falls outside the project boundary

#### 💉 No shell injection

Package manager commands use `execFile()` with arguments as a typed array — never string concatenation into `exec()`. Registry-supplied package names cannot inject shell commands.

```ts
// ✅ What we do
execFile('pnpm', ['add', '@radix-ui/react-slot'])

// ❌ What we never do
exec(`pnpm add ${packageName}`)
```

#### 🔇 No stdout pollution

The stdio transport uses stdout as the JSON-RPC channel. All logging is `console.error()` only. A single `console.log()` would corrupt the protocol — this server has none.

#### 📂 Minimal filesystem scope

The server reads only `components.json`, `package.json`, and the directories those files reference. It never touches `.env`, SSH keys, credential files, or your home directory.

#### ✅ Input validation

Every tool input is validated by a Zod schema before any code runs. Invalid inputs are rejected with descriptive error messages, never passed downstream.

---

## Architecture

```
src/
├── index.ts              Entry point — stdio transport, process lifecycle
├── server.ts             McpServer — all 6 tools registered with Zod schemas
├── types.ts              Interfaces + typed error classes (SecurityError, CircularDepError…)
│
├── tools/                Thin handlers — validate input, compose modules, format output
│   ├── add-component.ts
│   ├── detect-project.ts
│   ├── get-component-info.ts
│   ├── list-components.ts
│   ├── list-installed.ts
│   └── search-components.ts
│
├── registry/
│   ├── client.ts         HTTPS-only fetch · host whitelist · 5-min in-memory cache · 2× retry
│   └── resolver.ts       Recursive dep tree · cycle detection (visited set) · depth limit 20
│
├── project/
│   ├── analyzer.ts       Walks up to components.json · framework + pkg manager detection
│   └── scanner.ts        Checks installed components by scanning configured directories
│
└── writer/
    ├── file-writer.ts    Path-validated writes · dry-run support · directory auto-creation
    ├── css-writer.ts     Idempotent CSS variable merging · skips existing vars
    └── pkg-installer.ts  execFile-based installs · per-package fallback on batch failure
```

---

## Development

```bash
git clone https://github.com/Rachidhssin/shadcn-registry-mcp
cd shadcn-registry-mcp
npm install

npm run dev          # Run with tsx — no build step needed
npm run build        # Compile TypeScript → dist/
npm test             # Run 12 tests with vitest
npm run test:watch   # Watch mode
```

---

## Roadmap

- [ ] Fuzzy search / "did you mean?" suggestions on typos
- [ ] `remove_component` tool — clean uninstall with CSS var cleanup
- [ ] Component category groups — `add all form components` in one call
- [ ] Custom registry support (internal design systems)
- [ ] `.mcpb` bundle for one-click install in supported clients

---

## Contributing

1. Fork and branch: `git checkout -b feat/your-feature`
2. Make changes with tests
3. Verify: `npm test` and `npm run build` both pass cleanly
4. Open a PR

All security properties must be preserved. New network destinations, filesystem paths, or shell invocations require explicit justification in the PR description.

---

<div align="center">

MIT License &nbsp;·&nbsp; Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) &nbsp;·&nbsp; Powered by the [shadcn/ui registry](https://ui.shadcn.com)

</div>
