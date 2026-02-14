/**
 * Simple in-memory rate limiter for API routes.
 * Limits requests per IP address within a sliding time window.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

// Clean up expired entries periodically (only in non-test environments)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  cleanupTimer = setInterval(cleanupExpired, 60_000);
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 10, windowSeconds: 60 }
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowSeconds * 1000;
    store.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: config.limit - 1, resetTime };
  }

  entry.count++;
  store.set(identifier, entry);

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

export function rateLimitResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}
