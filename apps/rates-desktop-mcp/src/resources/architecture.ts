import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ARCHITECTURE } from '../knowledge';

export function registerArchitectureResource(server: McpServer): void {
  server.resource(
    'architecture',
    'rates://architecture',
    {
      description: 'Nx workspace topology, library dependency graph, tech stack, data flow, and build commands',
      mimeType: 'text/markdown',
    },
    async () => {
      const content = [
        '# Rates E-Trading Desktop — Architecture',
        '',
        '## Overview',
        ARCHITECTURE.overview,
        '',
        '## Tech Stack',
        ...Object.entries(ARCHITECTURE.techStack).map(([k, v]) => `- **${k}**: ${v}`),
        '',
        '## Nx Workspace',
        '',
        '### Applications',
        ...ARCHITECTURE.nxWorkspace.apps.map((a) => `- **${a.name}** (${a.type}): ${a.description}`),
        '',
        '### Libraries',
        ...ARCHITECTURE.nxWorkspace.libs.map((l) => `- **${l.name}** (${l.path}): ${l.description}\n  Exports: ${l.exports.join(', ')}`),
        '',
        '## Library Dependency Graph',
        '```',
        ARCHITECTURE.libDependencyGraph.trim(),
        '```',
        '',
        '## Data Flow',
        '```',
        ARCHITECTURE.dataFlow.trim(),
        '```',
        '',
        '## Build Commands',
        ...Object.entries(ARCHITECTURE.buildCommands).map(([k, v]) => `- **${k}**: \`${v}\``),
        '',
        '## Key Files',
        ...Object.entries(ARCHITECTURE.keyFiles).map(([k, v]) => `- **${k}**: \`${v}\``),
        '',
        '## Conventions',
        ...Object.entries(ARCHITECTURE.conventions).map(([k, v]) => `- **${k}**: ${v}`),
      ].join('\n');

      return { contents: [{ uri: 'rates://architecture', text: content, mimeType: 'text/markdown' }] };
    },
  );
}
