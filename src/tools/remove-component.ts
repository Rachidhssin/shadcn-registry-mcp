import { detectProject } from '../project/analyzer.js';
import { removeComponentFiles } from '../writer/file-remover.js';
import { isComponentInstalled } from '../project/scanner.js';

interface RemoveComponentOptions {
  names: string[];
}

export async function handleRemoveComponent({ names }: RemoveComponentOptions): Promise<string> {
  if (!names || names.length === 0) {
    return 'Error: at least one component name is required';
  }

  const validNames = [...new Set(names.filter(n => n.trim().length > 0))];
  if (validNames.length === 0) {
    return 'Error: component names cannot be empty';
  }

  try {
    const project = await detectProject();
    const lines: string[] = [];

    const removed: string[] = [];
    const notFound: string[] = [];
    const allDeletedFiles: string[] = [];

    for (const name of validNames) {
      const installed = await isComponentInstalled(name, project);
      if (!installed) {
        notFound.push(name);
        continue;
      }

      const result = await removeComponentFiles(name, project);
      if (result.deletedFiles.length > 0) {
        removed.push(name);
        allDeletedFiles.push(...result.deletedFiles);
      } else {
        notFound.push(name);
      }
    }

    if (removed.length > 0) {
      lines.push(`Removed (${removed.length}):`);
      lines.push(...removed.map(n => `  - ${n}`));
    }

    if (allDeletedFiles.length > 0) {
      lines.push(`\nFiles deleted (${allDeletedFiles.length}):`);
      lines.push(...allDeletedFiles.map(f => `  ${f}`));
    }

    if (notFound.length > 0) {
      lines.push(`\nNot installed (${notFound.length}):`);
      lines.push(...notFound.map(n => `  ✗ ${n}`));
    }

    if (removed.length === 0 && notFound.length > 0) {
      return `None of the specified components are installed in this project.`;
    }

    if (removed.length > 0) {
      lines.push(
        `\nNote: shared npm packages were not removed automatically.`,
        `Run your package manager's prune/dedupe command if needed.`
      );
    }

    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
