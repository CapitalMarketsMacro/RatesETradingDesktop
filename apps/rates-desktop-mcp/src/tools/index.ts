import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetTradingGlossary } from './get-trading-glossary';
import { registerGetComponentGuide } from './get-component-guide';
import { registerGetAmpsTopicSchema } from './get-amps-topic-schema';
import { registerGetProjectArchitecture } from './get-project-architecture';
import { registerGuideNewComponent } from './guide-new-component';
import { registerGuideNewService } from './guide-new-service';
import { registerGuideStatePersistence } from './guide-state-persistence';
import { registerGuideOpenFinTesting } from './guide-openfin-testing';
import { registerScaffoldBlotterComponent } from './scaffold-blotter-component';
import { registerScaffoldAmpsService } from './scaffold-amps-service';

export function registerTools(server: McpServer): void {
  registerGetTradingGlossary(server);
  registerGetComponentGuide(server);
  registerGetAmpsTopicSchema(server);
  registerGetProjectArchitecture(server);
  registerGuideNewComponent(server);
  registerGuideNewService(server);
  registerGuideStatePersistence(server);
  registerGuideOpenFinTesting(server);
  registerScaffoldBlotterComponent(server);
  registerScaffoldAmpsService(server);
}
