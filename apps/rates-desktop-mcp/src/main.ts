import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerResources } from './resources';
import { registerTools } from './tools';
import { registerPrompts } from './prompts';

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'rates-desktop-mcp',
    version: '1.0.0',
    description:
      'Rates E-Trading Desktop MCP Server — provides trading domain knowledge, developer guides, component catalog, AMPS topic schemas, and code scaffolding tools.',
  });

  // Register all capabilities
  registerResources(server);
  registerTools(server);
  registerPrompts(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
