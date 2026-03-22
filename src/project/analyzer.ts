import path from 'node:path';
import fs from 'node:fs/promises';
import type { ProjectInfo, ComponentsConfig } from '../types.js';
import { ProjectNotInitializedError } from '../types.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findConfigFile(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (true) {
    const candidate = path.join(current, 'components.json');
    if (await fileExists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current || current === root) {
      return null;
    }
    current = parent;
  }
}

async function detectPackageManager(projectRoot: string): Promise<ProjectInfo['packageManager']> {
  if (await fileExists(path.join(projectRoot, 'bun.lockb'))) return 'bun';
  if (await fileExists(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function detectFramework(projectRoot: string): Promise<ProjectInfo['framework']> {
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const allDeps = {
      ...((pkg.dependencies as Record<string, unknown>) ?? {}),
      ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
    };
    if ('next' in allDeps) {
      // Distinguish App Router vs Pages Router by directory structure
      const hasAppDir =
        (await fileExists(path.join(projectRoot, 'app'))) ||
        (await fileExists(path.join(projectRoot, 'src', 'app')));
      return hasAppDir ? 'nextjs-app' : 'nextjs-pages';
    }
    if ('vite' in allDeps) return 'vite';
  } catch {
    // can't read package.json
  }
  return 'unknown';
}

/**
 * Resolves a TypeScript path alias (like "@/components/ui") to an absolute
 * filesystem path, using the project root and src/ directory detection.
 */
function resolveAlias(alias: string | undefined, fallback: string, projectRoot: string, srcDir: string | null): string {
  if (!alias) {
    const base = srcDir ?? projectRoot;
    return path.join(base, fallback);
  }

  // Strip "@/" prefix — it maps to project root or src/
  const stripped = alias.replace(/^@\//, '');
  const base = srcDir ?? projectRoot;
  return path.join(base, stripped);
}

export async function detectProject(cwd?: string): Promise<ProjectInfo> {
  const startDir = cwd ?? process.cwd();
  const configPath = await findConfigFile(startDir);

  if (!configPath) {
    throw new ProjectNotInitializedError(startDir);
  }

  const projectRoot = path.dirname(configPath);

  let config: ComponentsConfig;
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(raw) as ComponentsConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse components.json at '${configPath}': ${message}`);
  }

  if (!config.style) {
    config.style = 'default';
  }

  const packageManager = await detectPackageManager(projectRoot);
  const framework = await detectFramework(projectRoot);

  // Detect src/ directory
  const srcDir = (await fileExists(path.join(projectRoot, 'src')))
    ? path.join(projectRoot, 'src')
    : null;

  // Resolve component directories from aliases
  const uiDir = resolveAlias(config.aliases?.ui, 'components/ui', projectRoot, srcDir);
  const hooksDir = resolveAlias(config.aliases?.hooks, 'hooks', projectRoot, srcDir);
  const libDir = resolveAlias(config.aliases?.lib, 'lib', projectRoot, srcDir);

  // Resolve CSS path
  let cssPath: string | null = null;
  if (config.tailwind?.css) {
    cssPath = path.join(projectRoot, config.tailwind.css);
  }

  return {
    projectRoot,
    configPath,
    config,
    packageManager,
    framework,
    srcDir,
    uiDir,
    hooksDir,
    libDir,
    cssPath,
  };
}
