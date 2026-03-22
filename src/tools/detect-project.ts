import { detectProject } from '../project/analyzer.js';

export async function handleDetectProject(): Promise<string> {
  try {
    const project = await detectProject();
    const lines = [
      `Project root: ${project.projectRoot}`,
      `Config: ${project.configPath}`,
      `Style: ${project.config.style}`,
      `Framework: ${project.framework}`,
      `Package manager: ${project.packageManager}`,
      `Src directory: ${project.srcDir ?? 'none (flat structure)'}`,
      `UI components dir: ${project.uiDir}`,
      `Hooks dir: ${project.hooksDir}`,
      `Lib dir: ${project.libDir}`,
      `CSS file: ${project.cssPath ?? 'not configured'}`,
    ];
    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}
