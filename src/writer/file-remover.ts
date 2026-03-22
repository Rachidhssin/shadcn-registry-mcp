import path from 'node:path';
import fs from 'node:fs/promises';
import type { ProjectInfo } from '../types.js';
import { SecurityError } from '../types.js';

function validatePath(resolvedPath: string, projectRoot: string): void {
  const normalized = path.resolve(resolvedPath);
  const root = path.resolve(projectRoot);
  if (!normalized.startsWith(root + path.sep) && normalized !== root) {
    throw new SecurityError(
      `Path traversal detected: '${resolvedPath}' is outside project root '${projectRoot}'`
    );
  }
}

export interface RemoveResult {
  name: string;
  deletedFiles: string[];
}

/**
 * Deletes all candidate files for a given component name across the
 * project's ui, hooks, and lib directories.
 *
 * Security: validates every path against the project root before deletion.
 * Returns the list of files that were actually found and deleted.
 */
export async function removeComponentFiles(
  name: string,
  project: ProjectInfo
): Promise<RemoveResult> {
  const candidates = [
    path.join(project.uiDir, `${name}.tsx`),
    path.join(project.uiDir, `${name}.ts`),
    path.join(project.hooksDir, `${name}.tsx`),
    path.join(project.hooksDir, `${name}.ts`),
    path.join(project.libDir, `${name}.ts`),
    path.join(project.libDir, `${name}.tsx`),
  ];

  const deletedFiles: string[] = [];

  for (const candidate of candidates) {
    validatePath(candidate, project.projectRoot);
    try {
      await fs.access(candidate);
      await fs.unlink(candidate);
      deletedFiles.push(candidate);
    } catch {
      // File doesn't exist — skip silently
    }
  }

  return { name, deletedFiles };
}
