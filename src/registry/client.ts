import type { RegistryItem } from '../types.js';
import { RegistryError, ComponentNotFoundError } from '../types.js';

const REGISTRY_BASE = 'https://ui.shadcn.com/r';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

// In-memory cache for the session
let indexCache: RegistryItem[] | null = null;
let indexFetchedAt = 0;
const INDEX_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  // SECURITY: Only allow fetches to the official shadcn registry
  const parsed = new URL(url);
  if (parsed.hostname !== 'ui.shadcn.com') {
    throw new Error(`SECURITY: Attempted fetch to unauthorized host: ${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout && attempt < MAX_RETRIES) {
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithTimeout(url, attempt + 1);
    }
    if (isTimeout) {
      throw new RegistryError('Registry request timed out after retries. Check your network connection.');
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      throw new RegistryError('Cannot resolve ui.shadcn.com. Check your network connection.');
    }
    throw new RegistryError(`Network error: ${message}`);
  }
}

export async function fetchRegistryIndex(): Promise<RegistryItem[]> {
  const now = Date.now();
  if (indexCache && (now - indexFetchedAt) < INDEX_TTL_MS) {
    return indexCache;
  }

  const url = `${REGISTRY_BASE}/index.json`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new RegistryError(`Registry returned HTTP ${response.status}`, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new RegistryError('Registry returned invalid JSON for index');
  }

  if (!Array.isArray(data)) {
    throw new RegistryError('Registry index has unexpected format (expected array)');
  }

  indexCache = data as RegistryItem[];
  indexFetchedAt = now;
  return indexCache;
}

export async function fetchRegistryItem(name: string, style: 'default' | 'new-york'): Promise<RegistryItem> {
  const url = `${REGISTRY_BASE}/styles/${style}/${name}.json`;
  const response = await fetchWithTimeout(url);

  if (response.status === 404) {
    throw new ComponentNotFoundError(name);
  }

  if (!response.ok) {
    throw new RegistryError(`Registry returned HTTP ${response.status} for component '${name}'`, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new RegistryError(`Registry returned invalid JSON for component '${name}'`);
  }

  const item = data as RegistryItem;
  if (!item.name || !item.type) {
    throw new RegistryError(`Component '${name}' data is missing required fields`);
  }

  return item;
}

export function clearIndexCache(): void {
  indexCache = null;
  indexFetchedAt = 0;
}
