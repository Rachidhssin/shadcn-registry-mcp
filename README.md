# shadcn-registry-mcp

An MCP (Model Context Protocol) server that automates [shadcn/ui](https://ui.shadcn.com) component installation. It fetches components directly from the official shadcn registry and writes them into your project — the same way `npx shadcn add` works, but driven by your AI assistant.

## What it does

- Fetches component source from `https://ui.shadcn.com/r/` (the official shadcn registry)
- Resolves the full dependency tree (registry deps + npm packages)
- Writes component files to the correct directories based on your `components.json` aliases
- Merges CSS variables into your `globals.css`
- Installs required npm packages using your detected package manager
- Supports dry-run mode to preview changes before applying them

## Installation

```bash
# Run directly with npx (no install required)
npx shadcn-registry-mcp

# Or install globally
npm install -g shadcn-registry-mcp
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "shadcn-registry-mcp": {
      "command": "npx",
      "args": ["shadcn-registry-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "shadcn-registry-mcp": {
      "command": "shadcn-registry-mcp"
    }
  }
}
```

### Claude Code (claude.ai/code)

Add to your `.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "shadcn-registry-mcp": {
      "command": "npx",
      "args": ["shadcn-registry-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

Or use the CLI:

```bash
claude mcp add shadcn-registry-mcp -- npx shadcn-registry-mcp
```

## Prerequisites

Your project must already be initialized with shadcn/ui:

```bash
npx shadcn@latest init
```

This creates the `components.json` file that the MCP server uses to discover your project configuration.

## Available Tools

### `detect_project`

Detects the current project configuration — framework, package manager, component directories, and shadcn setup.

```
No arguments required.
```

Example output:
```
Project root: /home/user/my-app
Config: /home/user/my-app/components.json
Style: default
Framework: nextjs-app
Package manager: pnpm
Src directory: /home/user/my-app/src
UI components dir: /home/user/my-app/src/components/ui
Hooks dir: /home/user/my-app/src/hooks
Lib dir: /home/user/my-app/src/lib
CSS file: /home/user/my-app/src/app/globals.css
```

### `list_components`

Lists all available shadcn/ui components from the official registry.

```
Arguments:
  category? (string) — Optional filter, e.g. "form", "layout", "data"
```

### `search_components`

Searches for components by name or description with ranked results.

```
Arguments:
  query (string, required) — Search term
```

### `get_component_info`

Shows detailed information about a component: files, registry dependencies, npm packages, CSS variables, and whether it's already installed in your project.

```
Arguments:
  name (string, required) — Component name, e.g. "button", "dialog"
```

### `add_component`

Installs one or more shadcn/ui components into your project. Automatically resolves and installs all dependencies.

```
Arguments:
  names (string[], required) — Component names to install, e.g. ["button", "dialog"]
  dryRun? (boolean, default: false) — Preview what would happen without writing files
```

### `list_installed`

Lists all shadcn/ui components currently installed in your project.

```
No arguments required.
```

## Example Usage

With your AI assistant connected to this MCP server, you can say:

> "Add a data table with pagination to my project"

The assistant will:
1. Call `search_components` to find `data-table`
2. Call `get_component_info` to check deps
3. Call `add_component` with `dryRun: true` to show what will be installed
4. After your confirmation, call `add_component` to actually install

## Security

This server is hardened against common attack vectors:

### Network Egress Restriction
All HTTP requests are validated before execution. **Only `https://ui.shadcn.com`** is an allowed host. Any attempt to fetch from another domain raises a security error and aborts the request. This prevents registry poisoning and SSRF attacks.

### Path Traversal Prevention
Every file path received from the registry is:
1. Validated against the resolved project root using `path.resolve()`
2. Checked for literal `..` segments before resolution
3. Rejected if it would write outside the project root

A `SecurityError` is thrown for any path that escapes the project boundary.

### Safe Process Execution
Package manager invocation uses **`execFile`** (not `exec`) with arguments passed as an array — never via string concatenation. This prevents shell injection attacks regardless of what package names the registry returns.

### No stdout Logging
The stdio transport uses stdout as the JSON-RPC channel. All diagnostic output uses `console.error()` only. Using `console.log()` would corrupt the protocol.

### Sensitive File Protection
The server never reads `.env` files, SSH keys, credential files, or home directories. It only reads `components.json`, `package.json`, and the directories defined in `components.json` aliases.

### Input Validation
All tool inputs are validated with Zod schemas before any code runs. Invalid inputs are rejected with descriptive error messages.

## Development

```bash
# Clone and install dependencies
git clone https://github.com/your-org/shadcn-registry-mcp
cd shadcn-registry-mcp
npm install

# Run in development mode (tsx, no build step)
npm run dev

# Build to dist/
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

## Architecture

```
src/
├── index.ts          — Entry point, stdio transport setup
├── server.ts         — MCP server, tool registration
├── types.ts          — Shared TypeScript interfaces and error classes
├── tools/            — One file per MCP tool handler
│   ├── add-component.ts
│   ├── detect-project.ts
│   ├── get-component-info.ts
│   ├── list-components.ts
│   ├── list-installed.ts
│   └── search-components.ts
├── registry/         — shadcn registry HTTP client and dep resolver
│   ├── client.ts     — Fetches index and component JSON; in-memory cache
│   └── resolver.ts   — Recursive dep tree resolution with cycle detection
├── project/          — Project detection and scanning
│   ├── analyzer.ts   — Finds components.json, detects framework + pkg manager
│   └── scanner.ts    — Checks which components are already installed
└── writer/           — Writes files and installs packages
    ├── file-writer.ts   — Writes component files with path validation
    ├── css-writer.ts    — Merges CSS variables into globals.css
    └── pkg-installer.ts — Installs npm packages via execFile
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Run `npm test` to confirm all tests pass
5. Run `npm run build` to confirm TypeScript compiles cleanly
6. Submit a pull request

Please follow the existing code style and ensure all security properties are preserved in any changes.

## License

MIT
