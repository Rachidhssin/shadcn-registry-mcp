#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // IMPORTANT: Never use console.log() in a stdio MCP server.
  // stdout is the JSON-RPC channel. Use console.error() for all logging.
  console.error('[shadcn-mcp] Starting shadcn-registry-mcp server...');

  await server.connect(transport);

  console.error('[shadcn-mcp] Server running on stdio');
}

main().catch(err => {
  console.error('[shadcn-mcp] Fatal error:', err);
  process.exit(1);
});
