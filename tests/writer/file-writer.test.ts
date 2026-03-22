import { describe, it, expect } from 'vitest';
import { dryRunComponentFiles } from '../../src/writer/file-writer.js';
import type { RegistryItem, ProjectInfo } from '../../src/types.js';
import { SecurityError } from '../../src/types.js';
import path from 'node:path';

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

describe('FileWriter', () => {
  describe('dryRunComponentFiles', () => {
    it('resolves UI component to uiDir', () => {
      const item: RegistryItem = {
        name: 'button',
        type: 'registry:ui',
        files: [{ path: 'ui/button.tsx', content: 'export {}', type: 'registry:ui', target: '' }],
      };
      const results = dryRunComponentFiles(item, mockProject);
      expect(results[0].filePath).toBe(path.join('/project/components/ui', 'button.tsx'));
    });

    it('throws SecurityError on path traversal attempt', () => {
      const item: RegistryItem = {
        name: 'evil',
        type: 'registry:ui',
        files: [{ path: 'ui/evil.tsx', content: 'bad', type: 'registry:ui', target: '../../etc/passwd' }],
      };
      expect(() => dryRunComponentFiles(item, mockProject)).toThrow(SecurityError);
    });

    it('resolves hook component to hooksDir', () => {
      const item: RegistryItem = {
        name: 'use-mobile',
        type: 'registry:hook',
        files: [{ path: 'hooks/use-mobile.tsx', content: 'export {}', type: 'registry:hook', target: '' }],
      };
      const results = dryRunComponentFiles(item, mockProject);
      expect(results[0].filePath).toBe(path.join('/project/hooks', 'use-mobile.tsx'));
    });
  });
});
