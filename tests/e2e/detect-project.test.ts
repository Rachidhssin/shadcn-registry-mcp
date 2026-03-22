import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  createTempProject,
  cleanupTempProject,
} from './helpers.js';

const { handleDetectProject } = await import('../../src/tools/detect-project.js');

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (tmpDir) await cleanupTempProject(tmpDir);
});

describe('handleDetectProject', () => {
  it('detects a Next.js App Router project', async () => {
    tmpDir = await createTempProject({ framework: 'nextjs-app' });
    process.chdir(tmpDir);

    const result = await handleDetectProject();

    expect(result).toContain('nextjs-app');
    expect(result).toContain('components.json');
  });

  it('detects a Vite project', async () => {
    tmpDir = await createTempProject({ framework: 'vite' });
    process.chdir(tmpDir);

    const result = await handleDetectProject();

    expect(result).toContain('vite');
  });

  it('resolves the ui directory from the @/ alias', async () => {
    tmpDir = await createTempProject({ framework: 'nextjs-app' });
    process.chdir(tmpDir);

    const result = await handleDetectProject();

    // Should contain the resolved ui path (src/components/ui)
    expect(result).toMatch(/components[/\\]ui/);
  });

  it('reports an error when no components.json is found', async () => {
    // chdir to a directory without components.json (the system temp dir itself)
    process.chdir(tmpdir());
    tmpDir = ''; // nothing to clean up

    const result = await handleDetectProject();

    expect(result).toContain('Error');
    expect(result).toMatch(/not initialized|components\.json/i);
  });
});
