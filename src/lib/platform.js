// Platform bridge: one code base for Windows / macOS (Electron), Android / iOS (Capacitor) and the browser.
// Exchange REST calls must not go through the browser's CORS layer, so:
//   - Electron  -> forwarded to the main process (window.leonNative.http)
//   - Capacitor -> CapacitorHttp is enabled in capacitor.config.json, which turns fetch() into a native request
//   - Browser   -> plain fetch (fine for market data; private exchange calls usually get blocked by CORS)
const w = typeof window !== "undefined" ? window : {};
export const isElectron = !!w.leonNative;
export const isCapacitor = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
export const platform = isElectron ? "desktop" : isCapacitor ? (w.Capacitor.getPlatform?.() || "mobile") : "web";
export const canTradeLive = isElectron || isCapacitor;

export async function http({ url, method = "GET", headers = {}, body }) {
  if (isElectron) {
    const r = await w.leonNative.http({ url, method, headers, body });
    if (r.error) throw new Error(r.error);
    return { status: r.status, text: r.text };
  }
  const r = await fetch(url, { method, headers, body });
  return { status: r.status, text: await r.text() };
}

export async function httpJSON(req) {
  const { status, text } = await http(req);
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status, data };
}

// keep the computer awake while bots are armed (desktop only, no-op elsewhere)
export const keepAwake = (on) => { try { w.leonNative?.keepAwake?.(!!on); } catch {} };
