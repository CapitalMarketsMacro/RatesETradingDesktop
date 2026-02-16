import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COMPONENT_CATEGORIES, TOPIC_NAMES } from '../knowledge';

export function registerNewTradingComponentPrompt(server: McpServer): void {
  server.prompt(
    'new_trading_component',
    'Guided conversation for creating a new trading component in the Rates Desktop application.',
    {
      name: z.string().describe('Component name in kebab-case (e.g., "rfq-blotter")'),
      category: z
        .enum(COMPONENT_CATEGORIES as unknown as [string, ...string[]])
        .optional()
        .describe('Component category'),
      ampsTopic: z.string().optional().describe('AMPS topic if the component subscribes to data'),
    },
    async ({ name, category, ampsTopic }) => {
      const messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }> = [];

      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: `I need to create a new trading component called "${name}" for the Rates E-Trading Desktop.${category ? ` It's a ${category} component.` : ''}${ampsTopic ? ` It subscribes to the ${ampsTopic} AMPS topic.` : ''}

Please help me:
1. Design the component architecture (service, model, component, route, menu)
2. Generate the code following existing patterns
3. Walk me through the registration steps

Use the following tools to help:
- get_component_guide: Check if similar components already exist
- get_amps_topic_schema: Get the schema for the AMPS topic (if applicable)
- guide_new_component: Get the step-by-step guide
- scaffold_blotter_component: Generate the complete code (if it's a grid blotter)
- scaffold_amps_service: Generate just the service code

Key patterns to follow:
- Services use Map<id, row> as single source of truth with rowUpdate$ and snapshot$ observables
- Components extend WorkspaceComponent for state persistence
- Grid components use DataGrid with highFrequencyMode for real-time updates
- All message handlers run inside ngZone.run()
- Routes go in app.routes.ts, menu items in app.ts`,
        },
      });

      return { messages };
    },
  );
}
