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

  const item = await fetchRegistryItem(name, style, project.config.registryUrl);
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
 * Levenshtein distance between two strings (case-insensitive).
 * Used for fuzzy component name matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Searches the registry index for a component name, returning suggestions
 * for similar names using Levenshtein distance and substring matching.
 * Returns up to 5 closest matches.
 */
export async function findComponentSuggestions(name: string, customRegistryUrl?: string): Promise<string[]> {
  try {
    const index = await fetchRegistryIndex(customRegistryUrl);
    const lower = name.toLowerCase();
    return index
      .map(item => ({ name: item.name, dist: levenshtein(lower, item.name.toLowerCase()) }))
      .filter(({ name: n, dist }) => dist <= 3 || n.includes(lower) || lower.includes(n))
      .sort((a, b) => a.dist - b.dist)
      .map(({ name: n }) => n)
      .slice(0, 5);
  } catch {
    return [];
  }
}
