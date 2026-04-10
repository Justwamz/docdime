/**
 * Simple in-memory sliding window rate limiter.
 * Compatible with both Node.js and Edge runtimes.
 * Works for single-instance deployments (Render).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key      Unique key (e.g. "login:1.2.3.4")
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

/** Extract client IP from Next.js request headers */
export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
