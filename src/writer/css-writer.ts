import fs from 'node:fs/promises';
import type { RegistryItem, ProjectInfo } from '../types.js';

/**
 * Generates CSS variable declarations for a given theme section.
 */
function buildCssBlock(vars: Record<string, string>, selector: string): string {
  const lines = Object.entries(vars).map(([key, value]) => `  --${key}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * Extracts CSS vars from a component and merges them into globals.css.
 * Skips variables that already exist. Returns count of variables added.
 *
 * If globals.css is not found, warns and returns 0 (non-fatal).
 */
export async function mergeCssVars(item: RegistryItem, project: ProjectInfo): Promise<number> {
  const cssVars = item.cssVars;
  if (!cssVars) return 0;

  const hasVars =
    (cssVars.light && Object.keys(cssVars.light).length > 0) ||
    (cssVars.dark && Object.keys(cssVars.dark).length > 0) ||
    (cssVars.theme && Object.keys(cssVars.theme).length > 0);

  if (!hasVars) return 0;

  if (!project.cssPath) {
    console.error(`[shadcn-mcp] No CSS file path configured — skipping CSS vars for '${item.name}'`);
    return 0;
  }

  let existing = '';
  try {
    existing = await fs.readFile(project.cssPath, 'utf-8');
  } catch {
    console.error(`[shadcn-mcp] globals.css not found at '${project.cssPath}' — skipping CSS vars for '${item.name}'`);
    return 0;
  }

  const blocks: string[] = [];
  let totalAdded = 0;

  // Light vars → :root
  if (cssVars.light && Object.keys(cssVars.light).length > 0) {
    const newVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVars.light)) {
      if (!existing.includes(`--${key}`)) {
        newVars[key] = value;
        totalAdded++;
      }
    }
    if (Object.keys(newVars).length > 0) {
      blocks.push(buildCssBlock(newVars, ':root'));
    }
  }

  // Dark vars → .dark
  if (cssVars.dark && Object.keys(cssVars.dark).length > 0) {
    const newVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVars.dark)) {
      if (!existing.includes(`--${key}`)) {
        newVars[key] = value;
        totalAdded++;
      }
    }
    if (Object.keys(newVars).length > 0) {
      blocks.push(buildCssBlock(newVars, '.dark'));
    }
  }

  // Theme vars → @layer base or :root
  if (cssVars.theme && Object.keys(cssVars.theme).length > 0) {
    const newVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVars.theme)) {
      if (!existing.includes(`--${key}`)) {
        newVars[key] = value;
        totalAdded++;
      }
    }
    if (Object.keys(newVars).length > 0) {
      blocks.push(buildCssBlock(newVars, ':root'));
    }
  }

  if (blocks.length > 0) {
    const comment = `\n/* shadcn-mcp: ${item.name} */\n`;
    const addition = comment + blocks.join('\n') + '\n';
    await fs.appendFile(project.cssPath, addition, 'utf-8');
  }

  return totalAdded;
}
