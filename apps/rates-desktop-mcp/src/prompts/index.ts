import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNewTradingComponentPrompt } from './new-trading-component';
import { registerDebugTransportPrompt } from './debug-transport';
import { registerOnboardDeveloperPrompt } from './onboard-developer';

export function registerPrompts(server: McpServer): void {
  registerNewTradingComponentPrompt(server);
  registerDebugTransportPrompt(server);
  registerOnboardDeveloperPrompt(server);
}
