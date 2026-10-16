// Market data engine. In the artifact this is a simulated live feed (no network).
// The desktop build swaps this for a real exchange feed (see feed adapter in desktop project).
export const COINS = [
  { s: "BTC", n: "Bitcoin", p: 67250, v: 0.012 },
  { s: "ETH", n: "Ethereum", p: 3420, v: 0.016 },
  { s: "SOL", n: "Solana", p: 158.4, v: 0.024 },
  { s: "BNB", n: "BNB", p: 592.1, v: 0.014 },
  { s: "XRP", n: "XRP", p: 0.6123, v: 0.022 },
  { s: "DOGE", n: "Dogecoin", p: 0.1387, v: 0.03 },
  { s: "ADA", n: "Cardano", p: 0.4521, v: 0.025 },
  { s: "AVAX", n: "Avalanche", p: 34.82, v: 0.027 },
  { s: "TON", n: "Toncoin", p: 6.94, v: 0.023 },
  { s: "LINK", n: "Chainlink", p: 14.62, v: 0.025 },
  { s: "DOT", n: "Polkadot", p: 6.31, v: 0.024 },
  { s: "TRX", n: "TRON", p: 0.1592, v: 0.015 },
  { s: "SUI", n: "Sui", p: 1.874, v: 0.032 },
  { s: "PEPE", n: "Pepe", p: 0.00001127, v: 0.04 },
  { s: "ARB", n: "Arbitrum", p: 0.7344, v: 0.03 },
  { s: "NEAR", n: "NEAR", p: 5.12, v: 0.028 },
];

export const MODES = {
  long: { tfs: ["1d", "3d", "1w"], def: "1d" },
  mid: { tfs: ["30m", "1h", "4h"], def: "4h" },
  scalp: { tfs: ["1m", "3m", "5m", "15m"], def: "5m" },
};
export const TF_SEC = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400, "3d": 259200, "1w": 604800 };

function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function coinInfo(sym) {
  const c = COINS.find((x) => x.s === sym);
  if (c) return c;
  const r = rng(hash(sym));
  return { s: sym, n: sym, p: +(Math.pow(10, r() * 4 - 1.5)).toPrecision(4), v: 0.02 + r() * 0.02, custom: true };
}

function stepVol(coin, tf) { return coin.v * Math.sqrt(TF_SEC[tf] / 86400) * 1.15; }

// Regime-switching random walk so strategies have real trends & ranges to fight over
export function genSeries(sym, tf, n = 520) {
  const coin = coinInfo(sym);
  const r = rng(hash(sym + "|" + tf));
  const vol = stepVol(coin, tf);
  const now = Math.floor(Date.now() / 1000 / TF_SEC[tf]) * TF_SEC[tf];
  let price = coin.p * Math.exp(-gauss(r) * vol * 8);
  let drift = 0, regimeLeft = 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (regimeLeft-- <= 0) { regimeLeft = 15 + Math.floor(r() * 45); drift = (r() - 0.5) * vol * (r() < 0.55 ? 0.9 : 0.15); }
    const o = price;
    const ret = drift + gauss(r) * vol;
    const c = o * Math.exp(ret);
    const h = Math.max(o, c) * Math.exp(Math.abs(gauss(r)) * vol * 0.45);
    const l = Math.min(o, c) * Math.exp(-Math.abs(gauss(r)) * vol * 0.45);
    const vlm = (0.6 + r() * 0.8) * (1 + Math.abs(ret) / vol);
    out.push({ t: now - (n - 1 - i) * TF_SEC[tf], o, h, l, c, vlm });
    price = c;
  }
  // anchor last close to the reference price
  const k = coin.p / out[n - 1].c;
  for (const b of out) { b.o *= k; b.h *= k; b.l *= k; b.c *= k; }
  return { sym, tf, bars: out, vol, drift: 0, tick: 0, r: rng(hash(sym + tf + Date.now())) };
}

// One live tick: nudge the forming candle, roll a new candle every few ticks
export const TICKS_PER_BAR = 7;
export function tick(series) {
  const { r, vol } = series;
  const bars = series.bars.slice();
  let last = { ...bars[bars.length - 1] };
  series.tick++;
  if (series.tick % 40 === 0) series.drift = (r() - 0.5) * vol * 0.12;
  const sub = vol / Math.sqrt(TICKS_PER_BAR);
  if (series.tick % TICKS_PER_BAR === 0) {
    bars.shift();
    const o = last.c;
    last = { t: last.t + TF_SEC[series.tf], o, h: o, l: o, c: o, vlm: 0.2 };
  }
  const c = last.c * Math.exp(series.drift + gauss(r) * sub);
  last.c = c; last.h = Math.max(last.h, c); last.l = Math.min(last.l, c); last.vlm += 0.1 + r() * 0.2;
  bars[bars.length - 1] = last;
  return { ...series, bars };
}

export function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(p >= 100 ? 2 : 3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(4);
}
