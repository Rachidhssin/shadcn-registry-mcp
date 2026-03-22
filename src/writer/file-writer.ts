import path from 'node:path';
import fs from 'node:fs/promises';
import type { RegistryItem, ProjectInfo } from '../types.js';
import { SecurityError } from '../types.js';

/**
 * Resolves a registry file's target path in the project.
 * Uses the `target` field if set; otherwise derives from the file path prefix.
 *
 * Registry file types and their default directories:
 *   registry:ui     → components/ui/
 *   registry:hook   → hooks/
 *   registry:lib    → lib/
 */
function resolveFilePath(filePath: string, fileType: string, target: string, project: ProjectInfo): string {
  // If target is explicitly set, use it relative to project root
  if (target && target.trim().length > 0) {
    return path.join(project.projectRoot, target);
  }

  // Strip the type prefix from path (e.g., "ui/button.tsx" → "button.tsx")
  const fileName = path.basename(filePath);

  if (fileType === 'registry:ui' || filePath.startsWith('ui/')) {
    return path.join(project.uiDir, fileName);
  }
  if (fileType === 'registry:hook' || filePath.startsWith('hooks/')) {
    return path.join(project.hooksDir, fileName);
  }
  if (fileType === 'registry:lib' || filePath.startsWith('lib/')) {
    return path.join(project.libDir, fileName);
  }

  // Default: put in the UI directory
  return path.join(project.uiDir, fileName);
}

/**
 * Validates that a resolved path is within the project root.
 * Throws SecurityError if path traversal is detected.
 */
function validatePath(resolvedPath: string, projectRoot: string): void {
  const normalized = path.resolve(resolvedPath);
  const root = path.resolve(projectRoot);

  if (!normalized.startsWith(root + path.sep) && normalized !== root) {
    throw new SecurityError(
      `Path traversal detected: '${resolvedPath}' is outside project root '${projectRoot}'`
    );
  }

  // Additional check: reject paths with '..' segments before resolution
  if (resolvedPath.includes('..')) {
    throw new SecurityError(`Path '${resolvedPath}' contains '..' — not allowed`);
  }
}

export interface WriteResult {
  name: string;
  filePath: string;
  existed: boolean;
}

/**
 * Writes all files for a registry component to the project.
 * Returns the list of files written and whether each already existed.
 */
export async function writeComponentFiles(
  item: RegistryItem,
  project: ProjectInfo
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];

  for (const file of item.files ?? []) {
    if (!file.content) continue;

    const targetPath = resolveFilePath(file.path, file.type, file.target, project);

    // Security: validate path is within project root
    validatePath(targetPath, project.projectRoot);

    let existed = false;
    try {
      await fs.access(targetPath);
      existed = true;
    } catch {
      existed = false;
    }

    // Create parent directory if needed
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Write file
    await fs.writeFile(targetPath, file.content, 'utf-8');

    results.push({ name: item.name, filePath: targetPath, existed });
  }

  return results;
}

/**
 * Computes what would be written in a dry run (no filesystem changes).
 */
export function dryRunComponentFiles(
  item: RegistryItem,
  project: ProjectInfo
): WriteResult[] {
  const results: WriteResult[] = [];
  for (const file of item.files ?? []) {
    if (!file.content) continue;
    const targetPath = resolveFilePath(file.path, file.type, file.target, project);
    validatePath(targetPath, project.projectRoot);
    results.push({ name: item.name, filePath: targetPath, existed: false });
  }
  return results;
}
