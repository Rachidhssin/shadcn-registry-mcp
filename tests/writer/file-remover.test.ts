import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProjectInfo } from '../../src/types.js';
import { SecurityError } from '../../src/types.js';

// Mock fs/promises so tests don't touch the real filesystem
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
    unlink: vi.fn(),
  },
}));

const { default: fs } = await import('node:fs/promises');
const { removeComponentFiles } = await import('../../src/writer/file-remover.js');

const mockProject: ProjectInfo = {
  projectRoot: '/project',
  configPath: '/project/components.json',
  config: { style: 'default' },
  packageManager: 'npm',
  framework: 'nextjs-app',
  srcDir: null,
  uiDir: '/project/components/ui',
  hooksDir: '/project/hooks',
  libDir: '/project/lib',
  cssPath: '/project/app/globals.css',
};

describe('FileRemover', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes files that exist and returns their paths', async () => {
    // Only the first candidate (/project/components/ui/button.tsx) exists
    (fs.access as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)   // button.tsx — exists
      .mockRejectedValue(new Error('ENOENT')); // all others — not found
    (fs.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await removeComponentFiles('button', mockProject);

    expect(result.name).toBe('button');
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles[0]).toContain('button.tsx');
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('returns empty deletedFiles when no candidate files exist', async () => {
    (fs.access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));

    const result = await removeComponentFiles('nonexistent', mockProject);

    expect(result.deletedFiles).toHaveLength(0);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('throws SecurityError when component name would escape project root via path traversal', async () => {
    const maliciousProject: ProjectInfo = {
      ...mockProject,
      uiDir: '/project/components/ui',
      // projectRoot is /project, but uiDir crafted to escape via ../
    };

    // Simulate a tampered uiDir pointing outside project root
    const escapingProject: ProjectInfo = {
      ...mockProject,
      uiDir: '/tmp/evil',
      projectRoot: '/project',
    };

    await expect(removeComponentFiles('button', escapingProject)).rejects.toThrow(SecurityError);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
