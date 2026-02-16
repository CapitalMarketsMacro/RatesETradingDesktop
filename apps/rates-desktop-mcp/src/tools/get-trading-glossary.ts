import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../knowledge';

export function registerGetTradingGlossary(server: McpServer): void {
  server.tool(
    'get_trading_glossary',
    'Search or filter the trading glossary. Returns definitions for D2D/D2C, RFQ, eSwap, 32nds pricing, venues, and more.',
    {
      term: z.string().optional().describe('Search for a specific term (case-insensitive, partial match)'),
      category: z
        .enum(GLOSSARY_CATEGORIES as unknown as [string, ...string[]])
        .optional()
        .describe('Filter by category: market-type, instrument, trading-concept, venue, acronym, technology'),
    },
    async ({ term, category }) => {
      let results = [...GLOSSARY];

      if (category) {
        results = results.filter((e) => e.category === category);
      }

      if (term) {
        const search = term.toLowerCase();
        results = results.filter(
          (e) =>
            e.term.toLowerCase().includes(search) ||
            e.definition.toLowerCase().includes(search) ||
            e.aliases?.some((a) => a.toLowerCase().includes(search)),
        );
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No glossary entries found${term ? ` matching "${term}"` : ''}${category ? ` in category "${category}"` : ''}. Use without parameters to see all entries.`,
            },
          ],
        };
      }

      const text = results
        .map((e) => {
          let entry = `**${e.term}** [${e.category}]`;
          if (e.aliases?.length) entry += ` _(${e.aliases.join(', ')})_`;
          entry += `\n${e.definition}`;
          if (e.relatedTerms?.length) entry += `\nRelated: ${e.relatedTerms.join(', ')}`;
          return entry;
        })
        .join('\n\n');

      return {
        content: [{ type: 'text' as const, text: `Found ${results.length} glossary entries:\n\n${text}` }],
      };
    },
  );
}
