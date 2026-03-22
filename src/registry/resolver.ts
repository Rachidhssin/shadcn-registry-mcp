import { fetchRegistryItem, fetchRegistryIndex } from './client.js';
import type { RegistryItem, ResolvedDep, ProjectInfo } from '../types.js';
import { CircularDepError } from '../types.js';
import { isComponentInstalled } from '../project/scanner.js';

const MAX_DEPTH = 20;
const FETCH_DELAY_MS = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolves the full dependency tree for a component, returning items in
 * installation order (dependencies first, then the component itself).
 */
export async function resolveDependencyTree(
  name: string,
  style: 'default' | 'new-york',
  project: ProjectInfo,
  visited: Set<string> = new Set(),
  path: string[] = [],
  depth = 0
): Promise<ResolvedDep[]> {
  if (depth > MAX_DEPTH) {
    throw new Error(`Dependency tree too deep (>20 levels) for '${name}'. Possible issue with registry data.`);
  }

  if (visited.has(name)) {
    const cycleStart = path.indexOf(name);
    if (cycleStart !== -1) {
      throw new CircularDepError([...path.slice(cycleStart), name]);
    }
    // Already processed, not a cycle — skip
    return [];
  }

  visited.add(name);
  const currentPath = [...path, name];

  if (depth > 0) {
    await sleep(FETCH_DELAY_MS);
  }

  const item = await fetchRegistryItem(name, style);
  const results: ResolvedDep[] = [];

  // Resolve registry dependencies first (depth-first)
  for (const depName of item.registryDependencies ?? []) {
    // Skip URL-based registry deps (custom registries — not supported in v1)
    if (depName.startsWith('http://') || depName.startsWith('https://')) {
      console.error(`[shadcn-mcp] Skipping URL registry dep: ${depName} (custom registries not supported in v1)`);
      continue;
    }
    const depResults = await resolveDependencyTree(depName, style, project, visited, currentPath, depth + 1);
    results.push(...depResults);
  }

  // Check if already installed
  const alreadyInstalled = await isComponentInstalled(name, project);

  results.push({ item, alreadyInstalled });
  return results;
}

/**
 * Collects all unique npm packages needed for a resolved dep tree.
 */
export function collectNpmPackages(deps: ResolvedDep[]): string[] {
  const seen = new Set<string>();
  const packages: string[] = [];
  for (const { item } of deps) {
    for (const pkg of item.dependencies ?? []) {
      if (!seen.has(pkg)) {
        seen.add(pkg);
        packages.push(pkg);
      }
    }
  }
  return packages;
}

/**
 * Searches the registry index for a component name, returning suggestions
 * for similar names if not found exactly.
 */
export async function findComponentSuggestions(name: string): Promise<string[]> {
  try {
    const index = await fetchRegistryIndex();
    const lower = name.toLowerCase();
    return index
      .filter(item => item.name.toLowerCase().includes(lower) || lower.includes(item.name.toLowerCase()))
      .map(item => item.name)
      .slice(0, 5);
  } catch {
    return [];
  }
}
