import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerArchitectureResource } from './architecture';
import { registerTradingGlossaryResource } from './trading-glossary';
import { registerComponentCatalogResource } from './component-catalog';
import { registerAmpsTopicSchemasResource } from './amps-topic-schemas';
import { registerOpenFinGuideResource } from './openfin-guide';
import { registerTransportGuideResource } from './transport-guide';

export function registerResources(server: McpServer): void {
  registerArchitectureResource(server);
  registerTradingGlossaryResource(server);
  registerComponentCatalogResource(server);
  registerAmpsTopicSchemasResource(server);
  registerOpenFinGuideResource(server);
  registerTransportGuideResource(server);
}
