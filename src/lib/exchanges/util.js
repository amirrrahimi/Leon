import { httpJSON } from "../platform";
export const decimals = (step) => { const s = String(step); if (s.includes("e-")) return +s.split("e-")[1]; const d = s.split(".")[1]; return d ? d.replace(/0+$/, "").length : 0; };
// round DOWN to the exchange step so orders never exceed balance / precision
export const floorStep = (x, step) => { const st = +step; if (!st) return String(x); const d = decimals(step); const v = Math.floor(x / st + 1e-9) * st; return v.toFixed(d); };
export const px = (p) => (p == null ? undefined : String(+(+p).toPrecision(6)));
export const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
export const cid = () => "leon" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export class ExError extends Error { constructor(ex, msg, raw) { super(`${ex}: ${msg}`); this.raw = raw; } }
export async function call(ex, req, ok) {
  const { status, data } = await httpJSON(req);
  const err = ok(data, status);
  if (err) throw new ExError(ex, err, data);
  return data;
}
const cache = new Map();
export const cached = async (key, fn, ttl = 3600e3) => { const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v; const v = await fn(); cache.set(key, { t: Date.now(), v }); return v; };
