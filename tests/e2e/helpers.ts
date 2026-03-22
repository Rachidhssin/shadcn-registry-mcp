import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Temp project factory
// ---------------------------------------------------------------------------

export interface TempProjectOptions {
  framework?: 'nextjs-app' | 'nextjs-pages' | 'vite' | 'none';
  extraConfig?: Record<string, unknown>;
}

/**
 * Creates a temporary shadcn project directory on the real filesystem.
 * Mirrors the structure that detectProject() expects:
 *   <root>/components.json
 *   <root>/package.json
 *   <root>/src/app/          ← triggers nextjs-app detection
 *   <root>/src/components/ui/
 *   <root>/src/hooks/
 *   <root>/src/lib/
 *
 * Returns the absolute path to the temp directory.
 * Caller is responsible for calling cleanupTempProject() in afterEach.
 */
export async function createTempProject(opts: TempProjectOptions = {}): Promise<string> {
  const { framework = 'nextjs-app', extraConfig = {} } = opts;

  const dir = await mkdtemp(path.join(tmpdir(), 'shadcn-e2e-'));

  // Directory structure
  await mkdir(path.join(dir, 'src', 'components', 'ui'), { recursive: true });
  await mkdir(path.join(dir, 'src', 'hooks'), { recursive: true });
  await mkdir(path.join(dir, 'src', 'lib'), { recursive: true });

  // Framework-specific directories
  if (framework === 'nextjs-app') {
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
  } else if (framework === 'nextjs-pages') {
    await mkdir(path.join(dir, 'pages'), { recursive: true });
  }

  // package.json
  const deps: Record<string, string> = {};
  if (framework === 'nextjs-app' || framework === 'nextjs-pages') {
    deps['next'] = '14.0.0';
  } else if (framework === 'vite') {
    deps['vite'] = '5.0.0';
  }
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'test-app', dependencies: deps }),
  );

  // components.json
  const config = {
    style: 'default',
    aliases: {
      ui: '@/components/ui',
      hooks: '@/hooks',
      lib: '@/lib',
    },
    ...extraConfig,
  };
  await writeFile(path.join(dir, 'components.json'), JSON.stringify(config));

  return dir;
}

export async function cleanupTempProject(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mock registry fixtures
// ---------------------------------------------------------------------------

export const MOCK_BUTTON = {
  name: 'button',
  type: 'registry:ui',
  files: [
    {
      path: 'ui/button.tsx',
      type: 'registry:ui',
      target: '',
      content: 'export function Button() { return <button /> }',
    },
  ],
  dependencies: ['class-variance-authority', '@radix-ui/react-slot'],
  registryDependencies: [],
  cssVars: {},
};

export const MOCK_BADGE = {
  name: 'badge',
  type: 'registry:ui',
  files: [
    {
      path: 'ui/badge.tsx',
      type: 'registry:ui',
      target: '',
      content: 'export function Badge() { return <span /> }',
    },
  ],
  dependencies: ['class-variance-authority'],
  registryDependencies: [],
  cssVars: {},
};

/** badge depends on button — tests transitive resolution */
export const MOCK_BADGE_WITH_DEP = {
  ...MOCK_BADGE,
  registryDependencies: ['button'],
};

export const MOCK_INDEX = [
  { name: 'button', type: 'registry:ui' },
  { name: 'badge', type: 'registry:ui' },
  { name: 'dialog', type: 'registry:ui' },
  { name: 'input', type: 'registry:ui' },
  { name: 'label', type: 'registry:ui' },
  { name: 'separator', type: 'registry:ui' },
];

/**
 * Returns a fetch implementation function that routes by URL substring.
 * Entries are checked in order; first match wins. Unmatched URLs → 404.
 * Use with mockFetch.mockImplementation(makeMockFetch([...])).
 */
export function makeMockFetch(
  routes: Array<{ match: string; body: unknown; status?: number }>,
) {
  return (url: string) => {
    for (const route of routes) {
      if (url.includes(route.match)) {
        const status = route.status ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => route.body,
        });
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => null });
  };
}
