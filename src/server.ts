import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleListComponents } from './tools/list-components.js';
import { handleSearchComponents } from './tools/search-components.js';
import { handleGetComponentInfo } from './tools/get-component-info.js';
import { handleAddComponent } from './tools/add-component.js';
import { handleListInstalled } from './tools/list-installed.js';
import { handleDetectProject } from './tools/detect-project.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'shadcn-registry-mcp',
    version: '1.0.0',
  });

  // Tool: list_components
  server.registerTool(
    'list_components',
    {
      description: 'List all available shadcn/ui components from the official registry',
      inputSchema: {
        category: z.string().optional().describe('Optional category filter (e.g. "form", "layout", "data")'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ category }) => {
      const result = await handleListComponents(category);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool: search_components
  server.registerTool(
    'search_components',
    {
      description: 'Search for shadcn/ui components by name or description',
      inputSchema: {
        query: z.string().min(1).describe('Search query (component name, keyword, or description)'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query }) => {
      const result = await handleSearchComponents(query);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool: get_component_info
  server.registerTool(
    'get_component_info',
    {
      description:
        'Get detailed information about a shadcn/ui component including dependencies, files, and whether it is already installed in the current project',
      inputSchema: {
        name: z.string().min(1).describe('Component name (e.g. "button", "dialog", "sidebar")'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ name }) => {
      const result = await handleGetComponentInfo(name);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool: add_component
  server.registerTool(
    'add_component',
    {
      description:
        'Install one or more shadcn/ui components into the current project. Automatically resolves and installs all dependencies. Use dryRun=true to preview what would be installed without making changes.',
      inputSchema: {
        names: z
          .array(z.string().min(1))
          .min(1)
          .describe('Component names to install (e.g. ["button", "dialog"])'),
        dryRun: z
          .boolean()
          .optional()
          .default(false)
          .describe('Preview what would be installed without writing any files (default: false)'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ names, dryRun }) => {
      const result = await handleAddComponent({ names, dryRun });
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool: list_installed
  server.registerTool(
    'list_installed',
    {
      description: 'List all shadcn/ui components that are currently installed in the project',
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const result = await handleListInstalled();
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool: detect_project
  server.registerTool(
    'detect_project',
    {
      description:
        'Detect the current project configuration: framework, package manager, component paths, and shadcn setup',
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const result = await handleDetectProject();
      return { content: [{ type: 'text', text: result }] };
    }
  );

  return server;
}
