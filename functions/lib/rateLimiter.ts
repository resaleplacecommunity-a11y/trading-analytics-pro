/**
 * In-memory rate limiter for API endpoints
 * Prevents spam and duplicate requests
 */

const requestCounts = new Map(); // key -> { count, resetAt }
const inFlightRequests = new Map(); // key -> Promise

/**
 * Check if request is allowed under rate limit
 * @param {string} key - Unique identifier (e.g., "user:email:action")
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if allowed, false if rate limited
 */
export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Deduplicate identical in-flight requests
 * @param {string} key - Unique identifier
 * @param {Function} fn - Async function to execute
 * @returns {Promise} - Result of fn or existing in-flight request
 */
export async function deduplicateRequest(key, fn) {
  if (inFlightRequests.has(key)) {
    return await inFlightRequests.get(key);
  }

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return await promise;
}

/**
 * Clear old entries (cleanup)
 */
export function cleanupRateLimiter() {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupRateLimiter, 300000);