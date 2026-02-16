import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerOnboardDeveloperPrompt(server: McpServer): void {
  server.prompt(
    'onboard_developer',
    'Guided onboarding for new developers joining the Rates E-Trading team.',
    {},
    async () => {
      const messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }> = [];

      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: `I'm new to the Rates E-Trading Desktop codebase. Please give me a comprehensive onboarding overview.

Use these MCP tools to pull the relevant information:

1. **get_project_architecture** — Show me the full workspace structure, tech stack, and library graph
2. **get_trading_glossary** — Explain the key trading terms I need to know (D2D, D2C, RFQ, 32nds, SOW, etc.)
3. **get_component_guide** for "market-data-blotter" — Walk me through a real implemented component
4. **get_amps_topic_schema** for "rates/marketData" — Show me how data flows through AMPS
5. **guide_state_persistence** — Explain the WorkspaceComponent pattern
6. **guide_openfin_testing** — Show me how to run and test the app

After pulling this information, please organize it into a structured onboarding guide covering:

1. **Business Context**: What does this app do? Who uses it? (D2D/D2C trading desks)
2. **Architecture Overview**: Nx monorepo, Angular + OpenFin, AMPS messaging
3. **Key Libraries**: What each lib provides and how they connect
4. **Data Flow**: From AMPS message → Service → Component → AG Grid
5. **Development Workflow**: How to serve, test, and add new features
6. **Code Patterns**: Service pattern, WorkspaceComponent, DataGrid usage
7. **Glossary**: Essential trading terms for the domain

This will be my reference guide as I ramp up on the codebase.`,
        },
      });

      return { messages };
    },
  );
}
