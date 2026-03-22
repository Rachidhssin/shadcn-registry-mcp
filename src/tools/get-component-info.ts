import { fetchRegistryItem } from '../registry/client.js';
import { isComponentInstalled } from '../project/scanner.js';
import { detectProject } from '../project/analyzer.js';
import { ComponentNotFoundError } from '../types.js';

export async function handleGetComponentInfo(name: string): Promise<string> {
  try {
    const project = await detectProject();
    const item = await fetchRegistryItem(name, project.config.style);
    const alreadyInstalled = await isComponentInstalled(name, project);

    const lines: string[] = [];
    lines.push(`Component: ${item.name}`);
    if (item.title) lines.push(`Title: ${item.title}`);
    if (item.description) lines.push(`Description: ${item.description}`);
    lines.push(`Type: ${item.type}`);
    if (item.author) lines.push(`Author: ${item.author}`);
    lines.push(`Status: ${alreadyInstalled ? '✓ Already installed' : '○ Not installed'}`);

    // Files
    const files = item.files ?? [];
    if (files.length > 0) {
      lines.push(`\nFiles (${files.length}):`);
      for (const f of files) lines.push(`  ${f.path}`);
    }

    // Registry dependencies
    const regDeps = item.registryDependencies ?? [];
    if (regDeps.length > 0) {
      lines.push(`\nRegistry dependencies (${regDeps.length}):`);
      for (const dep of regDeps) {
        const depInstalled = await isComponentInstalled(dep, project);
        lines.push(`  ${depInstalled ? '✓' : '+'} ${dep}${depInstalled ? ' (already installed)' : ' (will be added)'}`);
      }
    }

    // npm packages
    const npmDeps = item.dependencies ?? [];
    if (npmDeps.length > 0) {
      lines.push(`\nnpm packages (${npmDeps.length}):`);
      for (const dep of npmDeps) lines.push(`  ${dep}`);
    }

    // CSS vars
    const cssVars = item.cssVars;
    if (cssVars) {
      const lightCount = Object.keys(cssVars.light ?? {}).length;
      const darkCount = Object.keys(cssVars.dark ?? {}).length;
      if (lightCount + darkCount > 0) {
        lines.push(`\nCSS variables: ${lightCount} light, ${darkCount} dark`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    if (err instanceof ComponentNotFoundError) {
      return `Component '${name}' not found in the shadcn registry.`;
    }
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
