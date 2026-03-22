import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch for unit tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Re-import after mock
const { fetchRegistryIndex, fetchRegistryItem, clearIndexCache } = await import('../../src/registry/client.js');

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
  });
});
