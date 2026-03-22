import { fetchRegistryIndex } from '../registry/client.js';
import { detectProject } from '../project/analyzer.js';
import type { RegistryItem } from '../types.js';

function formatItem(item: RegistryItem): string {
  const parts = [item.name];
  if (item.description) parts.push(`— ${item.description}`);
  const depCount = (item.registryDependencies?.length ?? 0) + (item.dependencies?.length ?? 0);
  if (depCount > 0) parts.push(`(${depCount} deps)`);
  return parts.join(' ');
}

export async function handleListComponents(category?: string): Promise<string> {
  try {
    let customRegistryUrl: string | undefined;
    try {
      const project = await detectProject();
      customRegistryUrl = project.config.registryUrl;
    } catch { /* not in a shadcn project — use official registry */ }

    const index = await fetchRegistryIndex(customRegistryUrl);

    let items = index.filter(item => item.type === 'registry:ui' || item.type === 'registry:component');

    if (category) {
      items = items.filter(item =>
        item.categories?.some(c => c.toLowerCase().includes(category.toLowerCase()))
      );
    }

    if (items.length === 0) {
      return category
        ? `No components found in category '${category}'.`
        : 'No components available in the registry.';
    }

    const lines = [`Found ${items.length} components:\n`, ...items.map(i => `  • ${formatItem(i)}`)];
    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
