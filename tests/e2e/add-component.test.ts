import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import {
  createTempProject,
  cleanupTempProject,
  fileExists,
  MOCK_BUTTON,
  MOCK_BADGE_WITH_DEP,
  MOCK_INDEX,
  makeMockFetch,
} from './helpers.js';

// Mock pkg-installer so tests never run real npm installs
vi.mock('../../src/writer/pkg-installer.js', () => ({
  installPackages: vi.fn().mockImplementation(async (packages: string[]) => ({
    installed: packages,
    failed: [],
  })),
}));

// Stub global fetch before any module imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic imports so mocks are fully in place first
const { handleAddComponent } = await import('../../src/tools/add-component.js');
const { clearIndexCache } = await import('../../src/registry/client.js');
const { installPackages } = await import('../../src/writer/pkg-installer.js');

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await createTempProject();
  process.chdir(tmpDir);
  clearIndexCache();
  vi.clearAllMocks();

  // Default registry: index + button + badge-with-dep
  mockFetch.mockImplementation(
    makeMockFetch([
      { match: '/index.json', body: MOCK_INDEX },
      { match: '/button.json', body: MOCK_BUTTON },
      { match: '/badge.json', body: MOCK_BADGE_WITH_DEP },
    ]),
  );
});

afterEach(async () => {
  process.chdir(originalCwd);
  await cleanupTempProject(tmpDir);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAddComponent — dry-run', () => {
  it('lists what would be installed without writing any files', async () => {
    const result = await handleAddComponent({ names: ['button'], dryRun: true });

    expect(result).toContain('DRY RUN');
    expect(result).toContain('button');
    expect(result).toContain('class-variance-authority');

    // No files should have been written
    const uiDir = path.join(tmpDir, 'src', 'components', 'ui');
    expect(await fileExists(path.join(uiDir, 'button.tsx'))).toBe(false);
  });

  it('resolves transitive registry deps in dry-run output', async () => {
    // badge depends on button — both should appear
    const result = await handleAddComponent({ names: ['badge'], dryRun: true });

    expect(result).toContain('DRY RUN');
    expect(result).toContain('badge');
    expect(result).toContain('button'); // transitive dep
  });

  it('returns error on unknown group name', async () => {
    const result = await handleAddComponent({ group: 'not-a-real-group', dryRun: true });
    expect(result).toContain('Error');
    expect(result).toContain('unknown group');
  });
});

describe('handleAddComponent — real install', () => {
  it('writes component file to the project ui directory', async () => {
    const result = await handleAddComponent({ names: ['button'] });

    expect(result).toContain('Installation complete');
    expect(result).toContain('button');

    const buttonPath = path.join(tmpDir, 'src', 'components', 'ui', 'button.tsx');
    expect(await fileExists(buttonPath)).toBe(true);
  });

  it('installs npm packages via installPackages', async () => {
    await handleAddComponent({ names: ['button'] });

    expect(installPackages).toHaveBeenCalledOnce();
    const [packages] = (installPackages as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(packages).toContain('class-variance-authority');
    expect(packages).toContain('@radix-ui/react-slot');
  });

  it('skips already-installed components on a second run', async () => {
    // First install
    await handleAddComponent({ names: ['button'] });
    vi.clearAllMocks();

    // Second install
    const result = await handleAddComponent({ names: ['button'] });

    expect(result).toContain('already installed');
    // installPackages should NOT be called since nothing new was installed
    expect(installPackages).not.toHaveBeenCalled();
  });

  it('installs transitive registry deps before the component itself', async () => {
    // badge depends on button — both files should appear
    const result = await handleAddComponent({ names: ['badge'] });

    expect(result).toContain('badge');
    expect(result).toContain('button');

    const buttonPath = path.join(tmpDir, 'src', 'components', 'ui', 'button.tsx');
    const badgePath = path.join(tmpDir, 'src', 'components', 'ui', 'badge.tsx');
    expect(await fileExists(buttonPath)).toBe(true);
    expect(await fileExists(badgePath)).toBe(true);
  });
});

describe('handleAddComponent — error handling', () => {
  it('returns "did you mean?" suggestions for a near-miss component name', async () => {
    // Mock the registry to 404 for a typo component, but index includes 'button'
    mockFetch.mockImplementation(
      makeMockFetch([
        { match: '/index.json', body: MOCK_INDEX },
        { match: '/buttn.json', status: 404, body: null },
        { match: '/styles/default/buttn.json', status: 404, body: null },
      ]),
    );

    const result = await handleAddComponent({ names: ['buttn'] });

    expect(result).toContain('Not found');
    expect(result).toContain('button'); // suggestion
  });

  it('requires at least one name or group', async () => {
    const result = await handleAddComponent({});
    expect(result).toContain('Error');
  });
});
