import { fetchRegistryIndex } from '../registry/client.js';
import { scanInstalledComponents } from '../project/scanner.js';
import { detectProject } from '../project/analyzer.js';

export async function handleListInstalled(): Promise<string> {
  try {
    const project = await detectProject();
    const index = await fetchRegistryIndex();
    const registryNames = new Set(index.map(item => item.name));
    const installed = await scanInstalledComponents(project, registryNames);

    if (installed.length === 0) {
      return 'No shadcn components installed in this project yet.';
    }

    const lines = [
      `${installed.length} shadcn component${installed.length === 1 ? '' : 's'} installed:\n`,
      ...installed.map(c => `  ✓ ${c.name} — ${c.filePath}`),
    ];
    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
