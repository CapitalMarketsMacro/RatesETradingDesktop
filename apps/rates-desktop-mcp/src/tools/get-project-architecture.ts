import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ARCHITECTURE } from '../knowledge';

export function registerGetProjectArchitecture(server: McpServer): void {
  server.tool(
    'get_project_architecture',
    'Get the full project architecture: Nx workspace topology, library dependency graph, tech stack, data flow, build commands, and conventions.',
    {},
    async () => {
      const lines: string[] = [
        '# Rates E-Trading Desktop — Architecture',
        '',
        '## Overview',
        ARCHITECTURE.overview,
        '',
        '## Tech Stack',
        ...Object.entries(ARCHITECTURE.techStack).map(([k, v]) => `- **${k}**: ${v}`),
        '',
        '## Applications',
        ...ARCHITECTURE.nxWorkspace.apps.map((a) => `- **${a.name}** (${a.type}): ${a.description} [executor: ${a.buildExecutor ?? 'n/a'}]`),
        '',
        '## Libraries',
        ...ARCHITECTURE.nxWorkspace.libs.map(
          (l) => `### ${l.name}\n- Path: \`${l.path}\`\n- ${l.description}\n- Exports: \`${l.exports.join('`, `')}\``,
        ),
        '',
        '## Dependency Graph',
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
        '## Naming Conventions',
        ...Object.entries(ARCHITECTURE.conventions).map(([k, v]) => `- **${k}**: ${v}`),
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
