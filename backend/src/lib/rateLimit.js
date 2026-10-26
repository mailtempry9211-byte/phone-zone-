/**
 * Small in-memory sliding-window rate limiter.
 *
 * PhoneZone is a single-shop desktop app, so this is deliberately not a
 * distributed limiter - it exists so the costly / destructive endpoints
 * (first-run setup, restore-from-file, backup restore, raw table writes) cannot
 * be hammered in a loop, which is the one thing an unattended local server is
 * actually exposed to.
 *
 * Limits are counted per caller IP and set well above any human pace, so a
 * normal admin workflow is never interrupted.
 */

const WINDOWS = new Set();
// Drop idle windows now and then so a long-running server cannot grow its maps
// forever. `unref()` keeps this timer from holding the process open.
setInterval(() => {
  const now = Date.now();
  for (const w of WINDOWS) w.prune(now);
}, 10 * 60 * 1000).unref();

/**
 * @param {number} max      allowed hits per caller per window
 * @param {number} windowMs window length in ms
 * @param {string} label    plural noun used in the error message
 */
export function makeLimiter(max, windowMs, label = "requests") {
  const hits = new Map(); // ip -> { count, windowStart }

  const limiter = {
    message: `Too many ${label}. Please wait a few minutes and try again.`,
    /** True when this caller may proceed. Never throws. */
    allow(req) {
      const key = String(req?.ip || "unknown");
      const now = Date.now();
      const record = hits.get(key);
      if (!record || now - record.windowStart > windowMs) {
        hits.set(key, { count: 1, windowStart: now });
        return true;
      }
      record.count++;
      return record.count <= max;
    },
    /** Test hook: forget every window. */
    reset() {
      hits.clear();
    },
    prune(now = Date.now()) {
      for (const [key, record] of hits) {
        if (now - record.windowStart > windowMs) hits.delete(key);
      }
    },
  };

  WINDOWS.add(limiter);
  return limiter;
}
