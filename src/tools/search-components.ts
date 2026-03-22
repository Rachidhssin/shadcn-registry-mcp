import { fetchRegistryIndex } from '../registry/client.js';
import type { RegistryItem } from '../types.js';

function scoreMatch(item: RegistryItem, query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  if (item.name.toLowerCase() === q) score += 100;
  else if (item.name.toLowerCase().startsWith(q)) score += 50;
  else if (item.name.toLowerCase().includes(q)) score += 20;
  if (item.description?.toLowerCase().includes(q)) score += 10;
  if (item.categories?.some(c => c.toLowerCase().includes(q))) score += 15;
  return score;
}

export async function handleSearchComponents(query: string): Promise<string> {
  if (!query.trim()) return 'Error: search query cannot be empty';

  try {
    const index = await fetchRegistryIndex();
    const scored = index
      .map(item => ({ item, score: scoreMatch(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return `No components found matching '${query}'.`;
    }

    const lines = [
      `Found ${scored.length} component${scored.length === 1 ? '' : 's'} matching '${query}':\n`,
      ...scored.map(({ item }) => {
        const depCount = (item.registryDependencies?.length ?? 0) + (item.dependencies?.length ?? 0);
        const depNote = depCount > 0 ? ` (${depCount} deps)` : '';
        const desc = item.description ? ` — ${item.description}` : '';
        return `  • ${item.name}${depNote}${desc}`;
      }),
    ];
    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
