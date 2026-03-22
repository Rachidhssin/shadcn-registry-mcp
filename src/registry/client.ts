import type { RegistryItem } from '../types.js';
import { RegistryError, ComponentNotFoundError } from '../types.js';

const OFFICIAL_BASE = 'https://ui.shadcn.com/r';
const OFFICIAL_HOST = 'ui.shadcn.com';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const INDEX_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Per-registry index caches, keyed by base URL
interface CacheEntry { items: RegistryItem[]; fetchedAt: number }
const indexCaches = new Map<string, CacheEntry>();

/**
 * Build the set of hosts permitted for outbound requests.
 * Always includes the official shadcn host.
 * If a custom registry URL is configured, its hostname is also allowed —
 * the user has opted in by adding it to components.json (a committed project file).
 */
export function buildAllowedHosts(customRegistryUrl?: string): Set<string> {
  const hosts = new Set<string>([OFFICIAL_HOST]);
  if (customRegistryUrl) {
    try {
      const parsed = new URL(customRegistryUrl);
      if (parsed.protocol === 'https:') hosts.add(parsed.hostname);
    } catch {
      // Invalid URL — ignored, will surface as a security error at fetch time
    }
  }
  return hosts;
}

function validateHost(url: string, allowedHosts: Set<string>): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`SECURITY: Invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`SECURITY: Only HTTPS registries are permitted (got ${parsed.protocol})`);
  }
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`SECURITY: Attempted fetch to unauthorized host: ${parsed.hostname}`);
  }
}

async function fetchWithTimeout(url: string, allowedHosts: Set<string>, attempt = 0): Promise<Response> {
  validateHost(url, allowedHosts);

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
      return fetchWithTimeout(url, allowedHosts, attempt + 1);
    }
    if (isTimeout) {
      throw new RegistryError('Registry request timed out after retries. Check your network connection.');
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      throw new RegistryError('Cannot reach registry. Check your network connection.');
    }
    throw new RegistryError(`Network error: ${message}`);
  }
}

function resolveEffectiveRegistryUrl(customRegistryUrl?: string): string {
  return customRegistryUrl ?? process.env.SHADCN_REGISTRY_URL ?? OFFICIAL_BASE;
}

/**
 * Fetches the registry index. Uses an in-memory cache per base URL (5-minute TTL).
 * If a custom registry URL is provided (from components.json or SHADCN_REGISTRY_URL env var),
 * fetches from that URL. Otherwise fetches from the official shadcn registry.
 */
export async function fetchRegistryIndex(customRegistryUrl?: string): Promise<RegistryItem[]> {
  const base = resolveEffectiveRegistryUrl(customRegistryUrl);
  const allowedHosts = buildAllowedHosts(customRegistryUrl ?? process.env.SHADCN_REGISTRY_URL);
  const now = Date.now();

  const cached = indexCaches.get(base);
  if (cached && now - cached.fetchedAt < INDEX_TTL_MS) {
    return cached.items;
  }

  const url = `${base}/index.json`;
  const response = await fetchWithTimeout(url, allowedHosts);

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

  const items = data as RegistryItem[];
  indexCaches.set(base, { items, fetchedAt: now });
  return items;
}

async function parseItemResponse(name: string, response: Response): Promise<RegistryItem> {
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

/**
 * Tries to fetch a component from a custom registry base URL.
 * Attempts the shadcn-compatible style path first, then a flat path.
 * Returns null if the component is not found (404) — caller should fall back to official.
 * Propagates non-404 HTTP errors and network errors (misconfigured registry).
 */
async function tryCustomRegistryItem(
  name: string,
  style: 'default' | 'new-york',
  base: string,
  allowedHosts: Set<string>
): Promise<RegistryItem | null> {
  // Try shadcn-compatible style path: {base}/styles/{style}/{name}.json
  const styleUrl = `${base}/styles/${style}/${name}.json`;
  const styleResponse = await fetchWithTimeout(styleUrl, allowedHosts);
  if (styleResponse.ok) return parseItemResponse(name, styleResponse);
  if (styleResponse.status !== 404) {
    throw new RegistryError(
      `Custom registry returned HTTP ${styleResponse.status} for '${name}'`,
      styleResponse.status
    );
  }

  // Try flat path: {base}/{name}.json (for simpler internal registries)
  const flatUrl = `${base}/${name}.json`;
  const flatResponse = await fetchWithTimeout(flatUrl, allowedHosts);
  if (flatResponse.ok) return parseItemResponse(name, flatResponse);

  // Not found in custom registry — caller falls back to official
  return null;
}

/**
 * Fetches a component by name. If a custom registry URL is configured, checks it first.
 * Falls back to the official shadcn registry if the component is not found in the custom one.
 * Throws ComponentNotFoundError if the component is not in either registry.
 */
export async function fetchRegistryItem(
  name: string,
  style: 'default' | 'new-york',
  customRegistryUrl?: string
): Promise<RegistryItem> {
  const effectiveCustom = customRegistryUrl ?? process.env.SHADCN_REGISTRY_URL;

  if (effectiveCustom && effectiveCustom !== OFFICIAL_BASE) {
    const customHosts = buildAllowedHosts(effectiveCustom);
    const item = await tryCustomRegistryItem(name, style, effectiveCustom, customHosts);
    if (item) return item;
    // Not in custom registry — fall through to official
  }

  // Official registry
  const officialHosts = new Set<string>([OFFICIAL_HOST]);
  const url = `${OFFICIAL_BASE}/styles/${style}/${name}.json`;
  const response = await fetchWithTimeout(url, officialHosts);

  if (response.status === 404) throw new ComponentNotFoundError(name);
  if (!response.ok) {
    throw new RegistryError(`Registry returned HTTP ${response.status} for component '${name}'`, response.status);
  }

  return parseItemResponse(name, response);
}

export function clearIndexCache(): void {
  indexCaches.clear();
}
