import crypto from 'node:crypto';

const ADMIN_SALT = 'caleb-emma-admin-v1';

/** Create an admin token after password verification */
export function createAdminToken(password: string): string | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return null;

  return crypto.createHash('sha256').update(`${expected}:${ADMIN_SALT}`).digest('hex');
}

/** Verify bearer token from admin requests */
export function verifyAdminToken(token: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !token) return false;

  const valid = crypto.createHash('sha256').update(`${expected}:${ADMIN_SALT}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(valid));
  } catch {
    return false;
  }
}

/** Extract bearer token from Authorization header */
export function getBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.slice(7);
}
