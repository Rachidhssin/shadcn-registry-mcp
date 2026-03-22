import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createTempProject,
  cleanupTempProject,
  fileExists,
  MOCK_INDEX,
  makeMockFetch,
} from './helpers.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { handleRemoveComponent } = await import('../../src/tools/remove-component.js');
const { clearIndexCache } = await import('../../src/registry/client.js');

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await createTempProject();
  process.chdir(tmpDir);
  clearIndexCache();

  mockFetch.mockImplementation(
    makeMockFetch([{ match: '/index.json', body: MOCK_INDEX }]),
  );
});

afterEach(async () => {
  process.chdir(originalCwd);
  await cleanupTempProject(tmpDir);
});

describe('handleRemoveComponent', () => {
  it('deletes an installed component file and reports it', async () => {
    // Pre-install the file manually
    const buttonPath = path.join(tmpDir, 'src', 'components', 'ui', 'button.tsx');
    await writeFile(buttonPath, 'export function Button() {}');
    expect(await fileExists(buttonPath)).toBe(true);

    const result = await handleRemoveComponent({ names: ['button'] });

    expect(result).toContain('Removed');
    expect(result).toContain('button');
    expect(await fileExists(buttonPath)).toBe(false);
  });

  it('reports not-installed when the component file does not exist', async () => {
    const result = await handleRemoveComponent({ names: ['nonexistent'] });

    expect(result).toContain('None of the specified components are installed');
  });

  it('removes multiple components in one call', async () => {
    const uiDir = path.join(tmpDir, 'src', 'components', 'ui');
    await writeFile(path.join(uiDir, 'button.tsx'), 'export function Button() {}');
    await writeFile(path.join(uiDir, 'badge.tsx'), 'export function Badge() {}');

    const result = await handleRemoveComponent({ names: ['button', 'badge'] });

    expect(result).toContain('Removed (2)');
    expect(await fileExists(path.join(uiDir, 'button.tsx'))).toBe(false);
    expect(await fileExists(path.join(uiDir, 'badge.tsx'))).toBe(false);
  });

  it('partially succeeds when some components are installed and others are not', async () => {
    const buttonPath = path.join(tmpDir, 'src', 'components', 'ui', 'button.tsx');
    await writeFile(buttonPath, 'export function Button() {}');

    const result = await handleRemoveComponent({ names: ['button', 'nonexistent'] });

    expect(result).toContain('button');
    expect(result).toContain('nonexistent');
    expect(await fileExists(buttonPath)).toBe(false);
  });

  it('requires at least one name', async () => {
    const result = await handleRemoveComponent({ names: [] });
    expect(result).toContain('Error');
  });
});
