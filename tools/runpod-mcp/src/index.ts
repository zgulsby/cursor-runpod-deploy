#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { deployToRunpod } from './deploy.js';

const server = new Server(
  {
    name: 'runpod-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'runpod.deploy',
        description: 'Deploy code to a Runpod serverless endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            endpointId: {
              type: 'string',
              description: 'The Runpod endpoint ID to deploy to',
            },
            workdirOrFile: {
              type: 'string',
              description: 'Path to directory or single file to deploy',
            },
            entrypoint: {
              type: 'string',
              description: 'Optional entrypoint specification (e.g., "handler.py:handler")',
            },
            env: {
              type: 'object',
              description: 'Environment variables to pass to the deployment',
              additionalProperties: { type: 'string' },
            },
            sync: {
              type: 'boolean',
              description: 'Whether to run synchronously (default: true)',
              default: true,
            },
          },
          required: ['endpointId', 'workdirOrFile'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'runpod.deploy') {
    try {
      const result = await deployToRunpod(args as {
        endpointId: string;
        workdirOrFile: string;
        entrypoint?: string;
        env?: Record<string, string>;
        sync?: boolean;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Runpod MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});