/** Shared constants used across client-side components */

export const STORAGE_KEY_UNLOCKED = 'wg_unlocked';

export const WORDLE_MAX_ATTEMPTS = 6;
export const WORDLE_WORD_LENGTH = 5;

export const API_VALIDATE_CODE = '/api/validate-code';
export const API_RSVP = '/api/rsvp';
export const API_ADMIN = '/api/admin';

export const ADMIN_TOKEN_KEY = 'admin_token';

/** Astro-only dev ports — API routes live on Netlify Dev (8888) */
const ASTRO_DEV_PORTS = new Set(['4321', '4322', '4323', '5173']);
const NETLIFY_DEV_PORT = '8888';

/**
 * Base URL for Netlify Functions in local dev.
 * Empty on production and when already on port 8888.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const { port, hostname, protocol } = window.location;
  if (port && ASTRO_DEV_PORTS.has(port)) {
    return `${protocol}//${hostname}:${NETLIFY_DEV_PORT}`;
  }
  return '';
}

/** Full URL for a Netlify Function API route */
export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}
