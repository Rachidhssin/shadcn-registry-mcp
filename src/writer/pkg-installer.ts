import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProjectInfo } from '../types.js';

const execFileAsync = promisify(execFile);
const INSTALL_TIMEOUT_MS = 120_000; // 2 minutes

type PkgManagerCommand = {
  command: string;
  addArgs: string[];
};

const PKG_MANAGER_COMMANDS: Record<ProjectInfo['packageManager'], PkgManagerCommand> = {
  npm: { command: 'npm', addArgs: ['install'] },
  pnpm: { command: 'pnpm', addArgs: ['add'] },
  yarn: { command: 'yarn', addArgs: ['add'] },
  bun: { command: 'bun', addArgs: ['add'] },
};

export interface InstallPkgResult {
  installed: string[];
  failed: string[];
}

/**
 * Installs a list of npm packages using the detected package manager.
 * Uses execFile (NOT exec) with array args to prevent command injection.
 *
 * Returns which packages installed successfully and which failed.
 */
export async function installPackages(
  packages: string[],
  project: ProjectInfo
): Promise<InstallPkgResult> {
  if (packages.length === 0) {
    return { installed: [], failed: [] };
  }

  const { command, addArgs } = PKG_MANAGER_COMMANDS[project.packageManager];
  const args = [...addArgs, ...packages];

  try {
    await execFileAsync(command, args, {
      cwd: project.projectRoot,
      timeout: INSTALL_TIMEOUT_MS,
    });
    return { installed: packages, failed: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // If the whole install failed, try packages individually for best-effort
    if (packages.length === 1) {
      console.error(`[shadcn-mcp] Failed to install '${packages[0]}': ${message}`);
      return { installed: [], failed: packages };
    }

    // Try each package individually
    const installed: string[] = [];
    const failed: string[] = [];

    for (const pkg of packages) {
      const singleArgs = [...addArgs, pkg];
      try {
        await execFileAsync(command, singleArgs, {
          cwd: project.projectRoot,
          timeout: INSTALL_TIMEOUT_MS,
        });
        installed.push(pkg);
      } catch (singleErr) {
        const singleMessage = singleErr instanceof Error ? singleErr.message : String(singleErr);
        console.error(`[shadcn-mcp] Failed to install '${pkg}': ${singleMessage}`);
        failed.push(pkg);
      }
    }

    return { installed, failed };
  }
}
