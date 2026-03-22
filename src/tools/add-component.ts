import { resolveDependencyTree, collectNpmPackages, findComponentSuggestions } from '../registry/resolver.js';
import { detectProject } from '../project/analyzer.js';
import { writeComponentFiles, dryRunComponentFiles } from '../writer/file-writer.js';
import { mergeCssVars } from '../writer/css-writer.js';
import { installPackages } from '../writer/pkg-installer.js';
import { ComponentNotFoundError, CircularDepError } from '../types.js';
import { resolveGroup } from '../registry/groups.js';

interface AddComponentOptions {
  names?: string[];
  group?: string;
  dryRun?: boolean;
}

export async function handleAddComponent({ names, group, dryRun = false }: AddComponentOptions): Promise<string> {
  // Resolve group → names if a group was specified
  if (group) {
    const groupResult = resolveGroup(group);
    if (!groupResult) {
      return `Error: unknown group '${group}'. Available groups: form, layout, navigation, overlay, data, feedback, typography`;
    }
    names = [...(names ?? []), ...groupResult.components];
  }

  if (!names || names.length === 0) {
    return 'Error: provide at least one component name or a group (e.g. group: "form")';
  }

  const validNames = [...new Set(names.filter(n => n.trim().length > 0))];
  if (validNames.length === 0) {
    return 'Error: component names cannot be empty';
  }

  try {
    const project = await detectProject();
    const style = project.config.style;

    // Results tracking
    const writtenFiles: string[] = [];
    const skippedComponents: string[] = [];
    const newComponents: string[] = [];
    const failedComponents: Array<{ name: string; error: string }> = [];
    let totalCssVarsAdded = 0;
    const allNpmPackages: string[] = [];
    const dryRunFiles: string[] = [];
    const dryRunDeps: string[] = [];

    // Process each requested component
    for (const componentName of validNames) {
      try {
        const resolved = await resolveDependencyTree(componentName, style, project);

        if (dryRun) {
          for (const { item, alreadyInstalled } of resolved) {
            if (alreadyInstalled) {
              skippedComponents.push(item.name);
            } else {
              dryRunDeps.push(item.name);
              const files = dryRunComponentFiles(item, project);
              dryRunFiles.push(...files.map(f => f.filePath));
            }
          }
          const npmPkgs = collectNpmPackages(resolved);
          allNpmPackages.push(...npmPkgs);
          continue;
        }

        // Install each resolved dep in order (deps first)
        for (const { item, alreadyInstalled } of resolved) {
          if (alreadyInstalled) {
            skippedComponents.push(item.name);
            continue;
          }

          try {
            const results = await writeComponentFiles(item, project);
            newComponents.push(item.name);
            writtenFiles.push(...results.map(r => r.filePath));

            const cssCount = await mergeCssVars(item, project);
            totalCssVarsAdded += cssCount;
          } catch (writeErr) {
            const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
            failedComponents.push({ name: item.name, error: msg });
          }
        }

        // Collect npm packages for all resolved deps (including skipped — they're already installed)
        const npmPkgs = collectNpmPackages(
          resolved.filter(r => !r.alreadyInstalled)
        );
        allNpmPackages.push(...npmPkgs);

      } catch (err) {
        if (err instanceof ComponentNotFoundError) {
          const suggestions = await findComponentSuggestions(componentName);
          const hint = suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : '';
          failedComponents.push({ name: componentName, error: `Not found in registry.${hint}` });
        } else if (err instanceof CircularDepError) {
          failedComponents.push({ name: componentName, error: err.message });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          failedComponents.push({ name: componentName, error: msg });
        }
      }
    }

    // Install npm packages (deduplicated)
    const uniqueNpmPackages = [...new Set(allNpmPackages)];
    let npmInstalled: string[] = [];
    let npmFailed: string[] = [];

    if (!dryRun && uniqueNpmPackages.length > 0) {
      const result = await installPackages(uniqueNpmPackages, project);
      npmInstalled = result.installed;
      npmFailed = result.failed;
    }

    // Build output summary
    return buildSummary({
      dryRun,
      newComponents,
      skippedComponents,
      failedComponents,
      writtenFiles,
      dryRunFiles,
      dryRunDeps,
      npmPackages: uniqueNpmPackages,
      npmInstalled,
      npmFailed,
      cssVarsAdded: totalCssVarsAdded,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

interface SummaryOptions {
  dryRun: boolean;
  newComponents: string[];
  skippedComponents: string[];
  failedComponents: Array<{ name: string; error: string }>;
  writtenFiles: string[];
  dryRunFiles: string[];
  dryRunDeps: string[];
  npmPackages: string[];
  npmInstalled: string[];
  npmFailed: string[];
  cssVarsAdded: number;
}

function buildSummary(opts: SummaryOptions): string {
  const lines: string[] = [];

  if (opts.dryRun) {
    lines.push('DRY RUN — no files written\n');
    if (opts.dryRunDeps.length > 0) {
      lines.push(`Would install (${opts.dryRunDeps.length}):`);
      lines.push(...opts.dryRunDeps.map(n => `  + ${n}`));
    }
    if (opts.skippedComponents.length > 0) {
      lines.push(`\nAlready installed (${opts.skippedComponents.length}) — would skip:`);
      lines.push(...opts.skippedComponents.map(n => `  ✓ ${n}`));
    }
    if (opts.dryRunFiles.length > 0) {
      lines.push(`\nFiles that would be written (${opts.dryRunFiles.length}):`);
      lines.push(...opts.dryRunFiles.map(f => `  ${f}`));
    }
    if (opts.npmPackages.length > 0) {
      lines.push(`\nnpm packages that would be installed:`);
      lines.push(...opts.npmPackages.map(p => `  ${p}`));
    }
    if (opts.failedComponents.length > 0) {
      lines.push(`\nWould fail (${opts.failedComponents.length}):`);
      lines.push(...opts.failedComponents.map(f => `  ✗ ${f.name}: ${f.error}`));
    }
  } else {
    const totalNew = opts.newComponents.length;
    const totalSkipped = opts.skippedComponents.length;

    if (totalNew === 0 && opts.failedComponents.length === 0) {
      lines.push(`All requested components were already installed.`);
    } else {
      lines.push(`Installation complete.\n`);
    }

    if (totalNew > 0) {
      lines.push(`Installed (${totalNew}):`);
      lines.push(...opts.newComponents.map(n => `  + ${n}`));
    }
    if (totalSkipped > 0) {
      lines.push(`\nSkipped — already installed (${totalSkipped}):`);
      lines.push(...opts.skippedComponents.map(n => `  ✓ ${n}`));
    }
    if (opts.writtenFiles.length > 0) {
      lines.push(`\nFiles written (${opts.writtenFiles.length}):`);
      lines.push(...opts.writtenFiles.map(f => `  ${f}`));
    }
    if (opts.npmInstalled.length > 0) {
      lines.push(`\nnpm packages installed:`);
      lines.push(...opts.npmInstalled.map(p => `  ${p}`));
    }
    if (opts.npmFailed.length > 0) {
      lines.push(`\nnpm packages FAILED to install (install manually):`);
      lines.push(...opts.npmFailed.map(p => `  ✗ ${p}`));
    }
    if (opts.cssVarsAdded > 0) {
      lines.push(`\nCSS variables added: ${opts.cssVarsAdded}`);
    }
    if (opts.failedComponents.length > 0) {
      lines.push(`\nFailed (${opts.failedComponents.length}):`);
      lines.push(...opts.failedComponents.map(f => `  ✗ ${f.name}: ${f.error}`));
    }
  }

  return lines.join('\n');
}
