import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GLOSSARY } from '../knowledge';

export function registerTradingGlossaryResource(server: McpServer): void {
  server.resource(
    'glossary',
    'rates://glossary',
    {
      description: 'Full trading glossary covering Bonds, Notes, Bills, eSwaps, D2D/D2C, venues, and technology',
      mimeType: 'text/markdown',
    },
    async () => {
      const byCategory = new Map<string, typeof GLOSSARY>();
      for (const entry of GLOSSARY) {
        const list = byCategory.get(entry.category) ?? [];
        list.push(entry);
        byCategory.set(entry.category, list);
      }

      const sections: string[] = ['# Rates Trading Glossary', ''];

      const categoryLabels: Record<string, string> = {
        'market-type': 'Market Types',
        instrument: 'Instruments',
        'trading-concept': 'Trading Concepts',
        venue: 'Venues',
        acronym: 'Acronyms',
        technology: 'Technology',
      };

      for (const [category, label] of Object.entries(categoryLabels)) {
        const entries = byCategory.get(category);
        if (!entries) continue;

        sections.push(`## ${label}`, '');
        for (const e of entries) {
          sections.push(`### ${e.term}${e.aliases ? ` (${e.aliases.join(', ')})` : ''}`);
          sections.push(e.definition);
          if (e.relatedTerms?.length) {
            sections.push(`*Related: ${e.relatedTerms.join(', ')}*`);
          }
          sections.push('');
        }
      }

      return { contents: [{ uri: 'rates://glossary', text: sections.join('\n'), mimeType: 'text/markdown' }] };
    },
  );
}
