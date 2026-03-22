import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

import fs from 'node:fs/promises';

const { detectProject } = await import('../../src/project/analyzer.js');

describe('ProjectAnalyzer', () => {
  describe('detectProject', () => {
    it('throws ProjectNotInitializedError when no components.json is found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      await expect(detectProject('/tmp/empty-project')).rejects.toThrow('No shadcn config');
    });

    it('throws on malformed components.json', async () => {
      vi.mocked(fs.access).mockImplementation(async (p) => {
        if (String(p).endsWith('components.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json' as any);
      await expect(detectProject('/tmp/bad-project')).rejects.toThrow('Failed to parse');
    });
  });
});
