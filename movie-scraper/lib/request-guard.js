/**
 * Best-effort protections for stateless serverless instances.
 * Limits apply per warm function instance; NOT a distributed quota or global queue.
 * A Redis/Upstash or platform WAF is needed before opening expensive providers publicly.
 */
import { createHash } from "node:crypto";

const stateKey = Symbol.for("cinesense.request-guard.v1");
function state() {
  if (!globalThis[stateKey]) globalThis[stateKey] = { windows: new Map(), inflight: new Map() };
  return globalThis[stateKey];
}

function opaque(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

export function requesterKey(request) {
  // Vercel's forwarded address is preferable; other headers may be spoofable.
  const raw = request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  return opaque(raw.split(",")[0].trim().slice(0, 128));
}

/** Sliding-window counter, bounded memory, with no sensitive strings stored. */
export function consumeLimit(group, id, limit, windowMs = 60_000, now = Date.now()) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000)
    throw Error("Invalid limiter configuration.");
  const s = state();
  const key = group + ":" + opaque(id);
  let recent = s.windows.get(key) || [];
  recent = recent.filter(timestamp => now - timestamp >= 0 && now - timestamp < windowMs);
  if (recent.length >= limit) {
    s.windows.set(key, recent);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  s.windows.set(key, recent);
  if (s.windows.size > 1024) {
    for (const [name, timestamps] of s.windows) {
      if (!timestamps.length || now - timestamps[timestamps.length - 1] >= windowMs) s.windows.delete(name);
    }
    // A cap prevents one instance holding unbounded attacker-controlled IDs.
    while (s.windows.size > 1024) s.windows.delete(s.windows.keys().next().value);
  }
  return { allowed: true, retryAfter: 0 };
}

export function limitResponse(retryAfter) {
  return Response.json({ error: "درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کنید." },
    { status: 429, headers: {
      "Retry-After": String(retryAfter || 60),
      "Cache-Control": "no-store",
    } });
}

/** Do not queue Chromium launches in a memory-constrained serverless worker. */
export function acquireSlot(group, maxActive = 1) {
  const s = state();
  const active = s.inflight.get(group) || 0;
  if (active >= maxActive) return null;
  s.inflight.set(group, active + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (s.inflight.get(group) || 1) - 1;
    if (remaining > 0) s.inflight.set(group, remaining);
    else s.inflight.delete(group);
  };
}

/** Test isolation only; never use during a request. */
export function resetGuardForTests() {
  globalThis[stateKey] = { windows: new Map(), inflight: new Map() };
}
