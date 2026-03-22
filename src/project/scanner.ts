import path from 'node:path';
import fs from 'node:fs/promises';
import type { ProjectInfo, InstalledComponent } from '../types.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the expected file path for a component in the project.
 * Returns null if the component type isn't mapped.
 */
export function getComponentFilePath(name: string, fileType: string, project: ProjectInfo): string | null {
  if (fileType === 'registry:ui') {
    return path.join(project.uiDir, `${name}.tsx`);
  }
  if (fileType === 'registry:hook') {
    return path.join(project.hooksDir, `use-${name.replace(/^use-/, '')}.tsx`);
  }
  if (fileType === 'registry:lib') {
    return path.join(project.libDir, `${name}.ts`);
  }
  return null;
}

/**
 * Checks if a component is already installed in the project.
 */
export async function isComponentInstalled(name: string, project: ProjectInfo): Promise<boolean> {
  // Check UI dir for .tsx and .ts
  const candidates = [
    path.join(project.uiDir, `${name}.tsx`),
    path.join(project.uiDir, `${name}.ts`),
    path.join(project.hooksDir, `${name}.tsx`),
    path.join(project.hooksDir, `${name}.ts`),
    path.join(project.libDir, `${name}.ts`),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return true;
  }
  return false;
}

/**
 * Scans the project's component directories and returns all installed
 * shadcn components (matched against the provided registry index names).
 */
export async function scanInstalledComponents(
  project: ProjectInfo,
  registryNames: Set<string>
): Promise<InstalledComponent[]> {
  const installed: InstalledComponent[] = [];
  const dirsToScan = [project.uiDir, project.hooksDir, project.libDir];

  for (const dir of dirsToScan) {
    let entries: string[];
    try {
      const dirEntries = await fs.readdir(dir);
      entries = dirEntries;
    } catch {
      continue; // Directory doesn't exist — skip
    }

    for (const entry of entries) {
      const nameWithoutExt = entry.replace(/\.(tsx?|jsx?)$/, '');
      const normalized = nameWithoutExt.replace(/^use-/, ''); // normalize hook names

      if (registryNames.has(nameWithoutExt) || registryNames.has(normalized)) {
        const matchedName = registryNames.has(nameWithoutExt) ? nameWithoutExt : normalized;
        installed.push({
          name: matchedName,
          filePath: path.join(dir, entry),
        });
      }
    }
  }

  return installed;
}
