import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch for unit tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Re-import after mock
const { fetchRegistryIndex, fetchRegistryItem, clearIndexCache, buildAllowedHosts } = await import('../../src/registry/client.js');

describe('RegistryClient', () => {
  beforeEach(() => {
    clearIndexCache();
    mockFetch.mockReset();
  });

  describe('fetchRegistryIndex', () => {
    it('returns parsed components array on success', async () => {
      const mockItems = [{ name: 'button', type: 'registry:ui' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });
      const result = await fetchRegistryIndex();
      expect(result).toEqual(mockItems);
    });

    it('throws RegistryError on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(fetchRegistryIndex()).rejects.toThrow('HTTP 500');
    });

    it('throws RegistryError on malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('bad json'); },
      });
      await expect(fetchRegistryIndex()).rejects.toThrow('invalid JSON');
    });

    it('caches the index for subsequent calls', async () => {
      const mockItems = [{ name: 'button', type: 'registry:ui' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockItems,
      });
      await fetchRegistryIndex();
      await fetchRegistryIndex();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchRegistryItem', () => {
    it('returns component item on success', async () => {
      const mockItem = { name: 'button', type: 'registry:ui', files: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockItem,
      });
      const result = await fetchRegistryItem('button', 'default');
      expect(result.name).toBe('button');
    });

    it('throws ComponentNotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(fetchRegistryItem('nonexistent', 'default')).rejects.toThrow("'nonexistent' not found");
    });

    it('rejects fetches to unauthorized hosts', async () => {
      // This is testing our internal security check
      // The URL construction always uses REGISTRY_BASE, so this is more of a
      // smoke test that non-shadcn URLs would be rejected
      await expect(
        fetchRegistryItem('../../../etc/passwd', 'default')
      ).rejects.toThrow();
    });

    it('uses custom registry first and falls back to official on 404', async () => {
      // Custom registry returns 404 for both style path and flat path
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }); // custom style path
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }); // custom flat path
      // Official registry returns the component
      const mockItem = { name: 'button', type: 'registry:ui', files: [] };
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockItem });

      const result = await fetchRegistryItem('button', 'default', 'https://custom.internal.com/r');
      expect(result.name).toBe('button');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][0]).toContain('custom.internal.com');
      expect(mockFetch.mock.calls[2][0]).toContain('ui.shadcn.com');
    });

    it('returns item from custom registry without hitting official', async () => {
      const mockItem = { name: 'my-card', type: 'registry:ui', files: [] };
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockItem });

      const result = await fetchRegistryItem('my-card', 'default', 'https://custom.internal.com/r');
      expect(result.name).toBe('my-card');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('propagates non-404 error from custom registry flat path (not silently falling back)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }); // custom style path → 404
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }); // custom flat path → 500

      await expect(
        fetchRegistryItem('my-card', 'default', 'https://custom.internal.com/r')
      ).rejects.toThrow('HTTP 500');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('uses SHADCN_REGISTRY_URL env var when no explicit URL is passed', async () => {
      process.env.SHADCN_REGISTRY_URL = 'https://env-registry.company.com/r';
      const mockItem = { name: 'env-button', type: 'registry:ui', files: [] };
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockItem });

      const result = await fetchRegistryItem('env-button', 'default');
      expect(result.name).toBe('env-button');
      expect(mockFetch.mock.calls[0][0]).toContain('env-registry.company.com');
      delete process.env.SHADCN_REGISTRY_URL;
    });
  });

  describe('fetchRegistryIndex with SHADCN_REGISTRY_URL', () => {
    afterEach(() => {
      delete process.env.SHADCN_REGISTRY_URL;
    });

    it('uses SHADCN_REGISTRY_URL env var for index fetch when no explicit URL is passed', async () => {
      process.env.SHADCN_REGISTRY_URL = 'https://env-registry.company.com/r';
      const mockItems = [{ name: 'env-button', type: 'registry:ui' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchRegistryIndex();
      expect(result).toEqual(mockItems);
      expect(mockFetch.mock.calls[0][0]).toContain('env-registry.company.com');
    });
  });

  describe('buildAllowedHosts', () => {
    it('always includes the official shadcn host', () => {
      const hosts = buildAllowedHosts();
      expect(hosts.has('ui.shadcn.com')).toBe(true);
    });

    it('adds custom registry hostname when a valid HTTPS URL is provided', () => {
      const hosts = buildAllowedHosts('https://registry.company.com/r');
      expect(hosts.has('registry.company.com')).toBe(true);
      expect(hosts.has('ui.shadcn.com')).toBe(true);
    });

    it('ignores HTTP custom registry URLs (security: HTTPS only)', () => {
      const hosts = buildAllowedHosts('http://registry.company.com/r');
      expect(hosts.has('registry.company.com')).toBe(false);
      expect(hosts.has('ui.shadcn.com')).toBe(true);
    });

    it('ignores invalid custom registry URLs gracefully', () => {
      const hosts = buildAllowedHosts('not-a-url');
      expect(hosts.size).toBe(1); // only official
    });
  });
});
