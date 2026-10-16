// Signal alerts (1.3.0): a sound the moment a strategy finds a fresh BUY or SELL point.
// Works the same on Windows / macOS (Electron) and Android / iOS (Capacitor WebView): the tones are synthesised
// with the Web Audio API, so there are no sound files to ship and nothing to download.
//  - BUY  = two rising notes,  SELL = two falling notes, so you can tell them apart without looking.
//  - Phones also vibrate (Android; iOS WebViews ignore vibration).
//  - A system notification is shown too when the window is in the background (desktop) and permission was given.
// Browsers and mobile WebViews only allow sound after the user has touched the app once: unlock() handles that.
let ctx = null;
const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;

export function unlock() {
  if (!AC) return;
  try { if (!ctx) ctx = new AC(); if (ctx.state === "suspended") ctx.resume(); } catch {}
}

const SOUNDS = {
  chime: { buy: [660, 990], sell: [990, 660], type: "sine", len: 0.22 },
  bell: { buy: [784, 1175, 1568], sell: [1568, 1175, 784], type: "triangle", len: 0.28 },
  pulse: { buy: [880, 880], sell: [440, 440], type: "square", len: 0.12 },
};
export const SOUND_IDS = Object.keys(SOUNDS);

export function beep(kind = "buy", { sound = "chime", alertVol: volume = 0.7 } = {}) {
  unlock(); if (!ctx) return false;
  const s = SOUNDS[sound] || SOUNDS.chime; const notes = kind === "sell" ? s.sell : s.buy;
  const now = ctx.currentTime + 0.02;
  notes.forEach((f, k) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = s.type; o.frequency.value = f;
    const t0 = now + k * s.len, peak = Math.max(0.0001, volume * (s.type === "square" ? 0.18 : 0.45));
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + s.len * 0.95);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + s.len);
  });
  return true;
}

export function vibrate(kind) {
  try {
    const H = window.Capacitor?.Plugins?.Haptics; // native phones: @capacitor/haptics (works on Android and iOS)
    if (H?.vibrate) { H.vibrate({ duration: kind === "sell" ? 400 : 250 }); return; }
    navigator.vibrate?.(kind === "sell" ? [90, 60, 90, 60, 90] : [180, 80, 180]);
  } catch {}
}

export async function askNotify() {
  try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch {}
}
export function notify(title, body) {
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(title, { body, silent: true }); } catch {}
}

// Fire once per (coin, timeframe, strategy, signal candle). The first scan after switching coin/timeframe only
// remembers what is already on the chart, so old points never ring.
export function makeWatcher() {
  const seen = new Set(); const primed = new Set();
  return function check(scope, items) {
    const fresh = [];
    const first = !primed.has(scope); primed.add(scope);
    for (const it of items) { const k = scope + "|" + it.id + "|" + it.t; if (seen.has(k)) continue; seen.add(k); if (!first) fresh.push(it); }
    if (seen.size > 5000) { seen.clear(); primed.clear(); }
    return fresh;
  };
}
