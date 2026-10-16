import * as I from "./indicators";
const cross = (a, b, i) => i > 0 && a[i - 1] != null && b[i - 1] != null && a[i] != null && b[i] != null && (a[i - 1] <= b[i - 1] && a[i] > b[i] ? 1 : a[i - 1] >= b[i - 1] && a[i] < b[i] ? -1 : 0);
const C = { saffron: "#e9a00e", sky: "#89a6bb", lilac: "#8f95d6", sage: "#c3d6ce", olive: "#7f9a2a", rust: "#d9700e", rose: "#e58fb0", teal: "#4fb3a9" };
/* Trading styles a strategy suits best (first = primary). Shown as "Best for" in the app. */
export const FITS = ["scalp", "day", "swing", "position", "range"];

/* Every strategy returns { sig, lines }. sig[i] = +1 long / -1 short, evaluated on CLOSED candles only.
   The "Pro" set stacks a trend filter (EMA200 / ADX) on top of a trigger, which is what kills most fake signals. */
export const STRATS = [
  { id: "trendpb", fit: ["swing", "day"], pro: true, modes: ["scalp", "mid", "long"], rr: 2, sl: 1.5, warm: 210,
    run(b) { const c = I.closes(b); const e50 = I.ema(c, 50), e200 = I.ema(c, 200); const R = I.rsi(c, 14);
      return { sig: c.map((_, i) => { if (!i || e200[i] == null) return 0; const up = c[i] > e200[i] && e50[i] > e200[i], dn = c[i] < e200[i] && e50[i] < e200[i];
        if (up && R[i - 1] < 42 && R[i] >= 42) return 1; if (dn && R[i - 1] > 58 && R[i] <= 58) return -1; return 0; }), lines: [{ v: e50, c: C.saffron }, { v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "stadx", fit: ["swing", "position"], pro: true, modes: ["scalp", "mid", "long"], rr: 2.5, sl: 1.8, warm: 210,
    run(b) { const c = I.closes(b); const st = I.supertrend(b, 10, 3); const A = I.adx(b, 14); const e200 = I.ema(c, 200);
      return { sig: st.dir.map((d, i) => { if (i < 11 || d === st.dir[i - 1] || A[i] == null || e200[i] == null || A[i] < 20) return 0; return d === 1 && c[i] > e200[i] ? 1 : d === -1 && c[i] < e200[i] ? -1 : 0; }), lines: [{ v: st.val, c: C.sage, dash: true }, { v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "squeeze", fit: ["day", "swing"], pro: true, modes: ["scalp", "mid", "long"], rr: 2.5, sl: 1.5, warm: 60,
    run(b) { const c = I.closes(b); const bb = I.bands(c, 20, 2); const kc = I.keltner(b, 20, 1.5); const e50 = I.ema(c, 50); let sq = 0;
      return { sig: c.map((_, i) => { if (bb.up[i] == null || kc.up[i] == null || e50[i] == null) return 0; const inside = bb.up[i] < kc.up[i] && bb.lo[i] > kc.lo[i]; if (inside) { sq++; return 0; } const was = sq; sq = 0; if (was < 5) return 0;
        if (c[i] > bb.up[i] && c[i] > e50[i]) return 1; if (c[i] < bb.lo[i] && c[i] < e50[i]) return -1; return 0; }), lines: [{ v: kc.up, c: C.sky }, { v: kc.lo, c: C.sky }, { v: e50, c: C.saffron }] }; } },
  { id: "confluence", fit: ["swing", "day"], pro: true, modes: ["scalp", "mid", "long"], rr: 2, sl: 1.5, warm: 210,
    run(b) { const c = I.closes(b); const e21 = I.ema(c, 21), e55 = I.ema(c, 55), e200 = I.ema(c, 200); const m = I.macd(c); const R = I.rsi(c, 14); const st = I.supertrend(b, 10, 3);
      const score = c.map((_, i) => (e200[i] == null || m.signal[i] == null ? null : (e21[i] > e55[i] ? 1 : -1) + (m.line[i] > m.signal[i] ? 1 : -1) + (R[i] > 50 ? 1 : -1) + (c[i] > e200[i] ? 1 : -1) + st.dir[i]));
      return { sig: score.map((s, i) => { if (!i || s == null || score[i - 1] == null) return 0; if (s >= 5 && score[i - 1] < 5) return 1; if (s <= -5 && score[i - 1] > -5) return -1; return 0; }), lines: [{ v: e21, c: C.saffron }, { v: e55, c: C.sky }, { v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "macdpro", fit: ["swing", "position"], pro: true, modes: ["mid", "long"], rr: 2.2, sl: 1.6, warm: 210,
    run(b) { const c = I.closes(b); const m = I.macd(c); const e200 = I.ema(c, 200); const A = I.adx(b, 14);
      return { sig: c.map((_, i) => { const x = cross(m.line, m.signal, i); if (!x || e200[i] == null || A[i] == null || A[i] < 18) return 0; return x === 1 && c[i] > e200[i] && m.line[i] < 0 ? 1 : x === -1 && c[i] < e200[i] && m.line[i] > 0 ? -1 : 0; }), lines: [{ v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "ha", fit: ["day", "scalp"], pro: true, modes: ["scalp", "mid"], rr: 2, sl: 1.4, warm: 60,
    run(b) { const h = I.heikin(b); const c = I.closes(b); const e50 = I.ema(c, 50); const tol = (x) => (x.h - x.l) * 0.05;
      return { sig: h.map((x, i) => { if (i < 3 || e50[i] == null) return 0; const p1 = h[i - 1], p2 = h[i - 2]; const bull = x.c > x.o && x.o - x.l <= tol(x), bear = x.c < x.o && x.h - x.o <= tol(x);
        if (bull && p1.c < p1.o && p2.c < p2.o && c[i] > e50[i]) return 1; if (bear && p1.c > p1.o && p2.c > p2.o && c[i] < e50[i]) return -1; return 0; }), lines: [{ v: e50, c: C.saffron }] }; } },
  { id: "vwapt", fit: ["scalp", "day"], pro: true, modes: ["scalp"], rr: 1.8, sl: 1.1, warm: 210,
    run(b) { const c = I.closes(b); const v = I.vwap(b, 30); const e9 = I.ema(c, 9); const e200 = I.ema(c, 200); return { sig: c.map((_, i) => { const x = cross(e9, v, i); if (!x || e200[i] == null) return 0; return x === 1 && c[i] > e200[i] ? 1 : x === -1 && c[i] < e200[i] ? -1 : 0; }), lines: [{ v, c: C.rust, w: 2 }, { v: e200, c: C.lilac, w: 2 }] }; } },
  // classics, kept for comparison
  { id: "supertrend", fit: ["position", "swing"], modes: ["scalp", "mid", "long"], rr: 2.5, sl: 2,
    run(b) { const st = I.supertrend(b, 10, 3); return { sig: st.dir.map((d, i) => (i > 10 && d !== st.dir[i - 1] ? d : 0)), lines: [{ v: st.val, c: C.sage, dash: true }] }; } },
  { id: "donchian", fit: ["position", "swing"], modes: ["mid", "long"], rr: 3, sl: 2,
    run(b) { const d = I.donchian(b, 20); return { sig: b.map((x, i) => (d.hi[i] == null ? 0 : x.c > d.hi[i] && b[i - 1].c <= d.hi[i - 1] ? 1 : x.c < d.lo[i] && b[i - 1].c >= d.lo[i - 1] ? -1 : 0)), lines: [{ v: d.hi, c: C.olive }, { v: d.lo, c: C.rust }] }; } },
  { id: "ema", fit: ["scalp", "day"], modes: ["scalp", "mid"], rr: 2, sl: 1.5,
    run(b) { const c = I.closes(b); const f = I.ema(c, 9), s = I.ema(c, 21); return { sig: c.map((_, i) => cross(f, s, i)), lines: [{ v: f, c: C.saffron }, { v: s, c: C.sky }] }; } },
  // ---- added in 1.3.0 ----
  { id: "bbrev", fit: ["range", "scalp"], modes: ["scalp", "mid"], rr: 1.5, sl: 1.2, warm: 60,
    run(b) { const c = I.closes(b); const bb = I.bands(c, 20, 2); const R = I.rsi(c, 14); const A = I.adx(b, 14);
      return { sig: c.map((_, i) => { if (!i || bb.lo[i - 1] == null || A[i] == null || A[i] > 28) return 0; if (c[i - 1] < bb.lo[i - 1] && c[i] > bb.lo[i] && R[i] < 45) return 1; if (c[i - 1] > bb.up[i - 1] && c[i] < bb.up[i] && R[i] > 55) return -1; return 0; }), lines: [{ v: bb.up, c: C.teal }, { v: bb.mid, c: C.sky, dash: true }, { v: bb.lo, c: C.teal }] }; } },
  { id: "stochrsi", fit: ["scalp", "day", "range"], modes: ["scalp", "mid"], rr: 1.8, sl: 1.2, warm: 60,
    run(b) { const c = I.closes(b); const s = I.stochRsi(c); const e50 = I.ema(c, 50);
      return { sig: c.map((_, i) => { const x = cross(s.k, s.d, i); if (!x || e50[i] == null) return 0; if (x === 1 && s.k[i - 1] < 25 && c[i] > e50[i]) return 1; if (x === -1 && s.k[i - 1] > 75 && c[i] < e50[i]) return -1; return 0; }), lines: [{ v: e50, c: C.saffron }] }; } },
  { id: "ichimoku", fit: ["swing", "position"], modes: ["mid", "long"], rr: 2.5, sl: 1.8, warm: 80,
    run(b) { const c = I.closes(b); const k = I.ichimoku(b);
      return { sig: c.map((_, i) => { const x = cross(k.tenkan, k.kijun, i); if (!x || k.spanA[i] == null || k.spanB[i] == null) return 0; const top = Math.max(k.spanA[i], k.spanB[i]), bot = Math.min(k.spanA[i], k.spanB[i]); return x === 1 && c[i] > top ? 1 : x === -1 && c[i] < bot ? -1 : 0; }), lines: [{ v: k.tenkan, c: C.saffron }, { v: k.kijun, c: C.rose }, { v: k.spanA, c: C.olive, dash: true }, { v: k.spanB, c: C.rust, dash: true }] }; } },
  { id: "psar", fit: ["swing", "day"], modes: ["scalp", "mid", "long"], rr: 2, sl: 1.5, warm: 210,
    run(b) { const c = I.closes(b); const p = I.psar(b); const e200 = I.ema(c, 200);
      return { sig: c.map((_, i) => { if (i < 2 || e200[i] == null || p.dir[i] === p.dir[i - 1]) return 0; return p.dir[i] === 1 && c[i] > e200[i] ? 1 : p.dir[i] === -1 && c[i] < e200[i] ? -1 : 0; }), lines: [{ v: p.val, c: C.sage, dash: true }, { v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "rsi2", fit: ["swing", "range"], modes: ["mid", "long"], rr: 1.5, sl: 1.5, warm: 210,
    run(b) { const c = I.closes(b); const R = I.rsi(c, 2); const m200 = I.sma(c, 200);
      return { sig: c.map((_, i) => { if (!i || m200[i] == null || R[i - 1] == null) return 0; if (c[i] > m200[i] && R[i - 1] >= 10 && R[i] < 10) return 1; if (c[i] < m200[i] && R[i - 1] <= 90 && R[i] > 90) return -1; return 0; }), lines: [{ v: m200, c: C.lilac, w: 2 }] }; } },
  { id: "engulf", fit: ["day", "swing"], modes: ["scalp", "mid"], rr: 2, sl: 1.3, warm: 60,
    run(b) { const c = I.closes(b); const e50 = I.ema(c, 50); const A = I.atr(b, 14);
      return { sig: b.map((x, i) => { if (!i || e50[i] == null) return 0; const p = b[i - 1]; const body = Math.abs(x.c - x.o); if (body < A[i] * 0.6) return 0;
        if (p.c < p.o && x.c > x.o && x.c >= p.o && x.o <= p.c && x.c > e50[i]) return 1; if (p.c > p.o && x.c < x.o && x.c <= p.o && x.o >= p.c && x.c < e50[i]) return -1; return 0; }), lines: [{ v: e50, c: C.saffron }] }; } },
  { id: "ribbon", fit: ["scalp"], modes: ["scalp"], rr: 1.6, sl: 1.1, warm: 60,
    run(b) { const c = I.closes(b); const e5 = I.ema(c, 5), e8 = I.ema(c, 8), e13 = I.ema(c, 13), e50 = I.ema(c, 50);
      const st = c.map((_, i) => (e13[i] == null ? 0 : e5[i] > e8[i] && e8[i] > e13[i] ? 1 : e5[i] < e8[i] && e8[i] < e13[i] ? -1 : 0));
      return { sig: st.map((d, i) => { if (!i || e50[i] == null || !d || d === st[i - 1]) return 0; return d === 1 && c[i] > e50[i] ? 1 : d === -1 && c[i] < e50[i] ? -1 : 0; }), lines: [{ v: e5, c: C.saffron }, { v: e8, c: C.rose }, { v: e13, c: C.sky }] }; } },
  { id: "cci", fit: ["day", "scalp"], modes: ["scalp", "mid"], rr: 2, sl: 1.4, warm: 210,
    run(b) { const c = I.closes(b); const K = I.cci(b, 20); const e200 = I.ema(c, 200);
      return { sig: c.map((_, i) => { if (!i || K[i - 1] == null || e200[i] == null) return 0; if (K[i - 1] <= 100 && K[i] > 100 && c[i] > e200[i]) return 1; if (K[i - 1] >= -100 && K[i] < -100 && c[i] < e200[i]) return -1; return 0; }), lines: [{ v: e200, c: C.lilac, w: 2 }] }; } },
  { id: "bos", fit: ["swing", "day"], modes: ["scalp", "mid", "long"], rr: 2.2, sl: 1.5, warm: 60,
    run(b) { const c = I.closes(b); const p = I.pivots(b, 3); const e50 = I.ema(c, 50);
      return { sig: c.map((_, i) => { if (!i || p.hi[i - 1] == null || p.lo[i - 1] == null || e50[i] == null) return 0; if (c[i - 1] <= p.hi[i - 1] && c[i] > p.hi[i - 1] && c[i] > e50[i]) return 1; if (c[i - 1] >= p.lo[i - 1] && c[i] < p.lo[i - 1] && c[i] < e50[i]) return -1; return 0; }), lines: [{ v: p.hi, c: C.olive, dash: true }, { v: p.lo, c: C.rust, dash: true }] }; } },
  { id: "dmi", fit: ["position", "swing"], modes: ["mid", "long"], rr: 2.5, sl: 1.8, warm: 60,
    run(b) { const c = I.closes(b); const d = I.dmi(b, 14); const A = I.adx(b, 14); const e50 = I.ema(c, 50);
      return { sig: c.map((_, i) => { const x = cross(d.pdi, d.ndi, i); if (!x || A[i] == null || A[i] < 20) return 0; return x; }), lines: [{ v: e50, c: C.saffron }] }; } },
];

/* Backtest with one position at a time:
   - opposite signal: CLOSE current position at candle close, then OPEN the new one ("rev")
   - stop loss / take profit checked on every candle after entry (stop first = conservative)
   - after +1R the stop moves to entry (break-even), so a winner can't turn into a full loss
   1.4.0 accuracy upgrade:
   - quality filter ("strict"): trend strategies only trade with a rising/falling EMA200 and ADX >= 18,
     range strategies only when ADX <= 25; skips low-volume candles and over-extended (> 2.5 ATR) candles
   - walk-forward tuning: stop (ATR x) and target (R) are chosen on the OLDER 70% of the history,
     then judged on the NEWEST 30% the tuner never saw ("out-of-sample"). Ranking uses that unseen part,
     so a strategy can't look good just because it was fitted to the past.
   - goal "accuracy" prefers a higher win rate (closer targets), "profit" prefers a higher expectancy */
export const MIN_POINTS = 50;
export const DEFAULT_OPTS = { strict: true, tune: true, goal: "accuracy" };
const GRID = { accuracy: { rr: [0.8, 1, 1.25, 1.5], sl: [1.3, 1.8, 2.4] }, profit: { rr: [1.5, 2, 2.5, 3], sl: [1, 1.5, 2] } };

const cache = new WeakMap();
function ctx(bars) {
  let c = cache.get(bars);
  if (!c) { const cl = I.closes(bars); c = { A: I.atr(bars, 14), e200: I.ema(cl, 200), adx: I.adx(bars, 14), vma: I.sma(bars.map((b) => b.vlm || 0), 20) }; cache.set(bars, c); }
  return c;
}
export function quality(bars, sig, strat) {
  const { A, e200, adx, vma } = ctx(bars); const range = strat.fit?.[0] === "range";
  return sig.map((d, i) => {
    if (!d) return 0; const b = bars[i];
    if (b.h - b.l > 2.5 * A[i]) return 0;                      // chasing a spike candle
    if (vma[i] != null && vma[i] > 0 && b.vlm < 0.8 * vma[i]) return 0; // no participation
    if (range) return adx[i] != null && adx[i] > 25 ? 0 : d;    // mean reversion needs a calm market
    if (i < 10 || e200[i] == null || e200[i - 10] == null) return 0;
    const up = b.c > e200[i] && e200[i] > e200[i - 10], dn = b.c < e200[i] && e200[i] < e200[i - 10];
    if ((d === 1 && !up) || (d === -1 && !dn)) return 0;         // never fight the big trend
    if (adx[i] != null && adx[i] < 18) return 0;                 // no trend = no trend trade
    return d;
  });
}

function sim(bars, sig, A, from, end, rr, slm) {
  const trades = []; let pos = null;
  const close = (i, px, why) => { const risk = Math.abs(pos.entry - pos.sl0) || 1e-12; trades.push({ ...pos, exitI: i, exit: px, pnl: pos.dir * (px / pos.entry - 1), r: (pos.dir * (px - pos.entry)) / risk, why }); pos = null; };
  for (let i = from; i <= end; i++) {
    const b = bars[i];
    if (pos && i > pos.entryI) {
      const R = Math.abs(pos.entry - pos.sl0);
      if (pos.dir === 1) { if (b.l <= pos.sl) close(i, pos.sl, pos.be ? "be" : "sl"); else if (b.h >= pos.tp) close(i, pos.tp, "tp"); else if (!pos.be && b.h >= pos.entry + R) { pos.sl = pos.entry; pos.be = true; } }
      else { if (b.h >= pos.sl) close(i, pos.sl, pos.be ? "be" : "sl"); else if (b.l <= pos.tp) close(i, pos.tp, "tp"); else if (!pos.be && b.l <= pos.entry - R) { pos.sl = pos.entry; pos.be = true; } }
    }
    if (i < end && sig[i]) {
      if (pos && pos.dir !== sig[i]) close(i, b.c, "rev");
      if (!pos) { const risk = A[i] * slm; pos = { dir: sig[i], entryI: i, entry: b.c, sl: b.c - sig[i] * risk, sl0: b.c - sig[i] * risk, tp: b.c + sig[i] * risk * rr, be: false }; }
    }
  }
  return { trades, pos };
}
// Wilson lower bound: a 60% win rate on 10 trades is worth less than 58% on 200 trades
const wilson = (w, n, z = 1.28) => (n ? (w / n + (z * z) / (2 * n) - z * Math.sqrt((w / n) * (1 - w / n) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0);
export function stats(trades) {
  const wins = trades.filter((t) => t.pnl > 1e-9).length, losses = trades.filter((t) => t.pnl < -1e-9).length, bes = trades.length - wins - losses;
  const gw = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0), gl = -trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
  const decided = wins + losses;
  return { n: trades.length, wins, losses, bes, decided, winRate: decided ? wins / decided : 0, pf: gl ? gw / gl : gw ? 9.99 : 0,
    ret: trades.reduce((s, t) => s * (1 + t.pnl), 1) - 1, exp: trades.length ? trades.reduce((s, t) => s + (t.r || 0), 0) / trades.length : 0, lb: wilson(wins, decided) };
}
const fitness = (st, goal) => { if (st.decided < 12) return -1e9 + st.decided; const pen = st.pf < 1 ? 0.5 : 1; return goal === "profit" ? st.exp * Math.sqrt(st.n) * pen : st.lb * pen + Math.min(st.pf, 3) * 0.02; };

export function backtest(bars, strat, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const from = strat.warm || 60;
  const raw = strat.run(bars);
  const sig = o.strict ? quality(bars, raw.sig, strat) : raw.sig; const lines = raw.lines;
  const { A } = ctx(bars);
  const last = bars.length - 1; // forming candle: managed live, never signals
  const split = Math.floor(from + (last - from) * 0.7);
  let rr = strat.rr, sl = strat.sl;
  if (o.tune && split - from > 150) {
    const g = GRID[o.goal] || GRID.accuracy;
    const rrs = strat.fixedRR ? [strat.rr] : [...new Set([strat.rr, ...g.rr])], sls = [...new Set([strat.sl, ...g.sl])];
    let best = -Infinity;
    for (const a of rrs) for (const b of sls) { const f = fitness(stats(sim(bars, sig, A, from, split, a, b).trades), o.goal); if (f > best) { best = f; rr = a; sl = b; } }
  }
  const { trades, pos } = sim(bars, sig, A, from, last, rr, sl);
  const st = stats(trades);
  const oos = stats(trades.filter((t) => t.entryI >= split));
  const live = pos ? { ...pos, upnl: pos.dir * (bars[last].c / pos.entry - 1) } : null;
  let lastSig = -1; for (let i = last - 1; i >= from; i--) if (sig[i]) { lastSig = i; break; }
  // every buy/sell point the strategy found on closed candles, newest first, with what happened to it
  const byEntry = new Map(trades.map((t) => [t.entryI, t]));
  const points = []; for (let i = last - 1; i >= from; i--) if (sig[i]) { const tr = byEntry.get(i); points.push({ i, dir: sig[i], t: bars[i].t, px: bars[i].c, res: tr ? tr.why : live && live.entryI === i ? "open" : "skip", pnl: tr ? tr.pnl : live && live.entryI === i ? live.upnl : null }); }
  const rank = oos.decided >= 6 ? (o.goal === "profit" ? oos.exp : oos.lb) + (oos.pf >= 1 ? 0.05 : -0.05) : (o.goal === "profit" ? st.exp : st.lb) * 0.8;
  const proven = oos.decided >= 10 && oos.pf >= 1.1 && oos.winRate >= 0.5;
  return { from, trades, ...st, score: (st.wins + 1) / (st.decided + 2), live, sig, lines, lastSig, lastDir: lastSig >= 0 ? sig[lastSig] : 0, points, scanned: last - from,
    params: { rr, sl }, oos, split, rank, proven };
}

/* "Leon Elite": a consensus strategy built from the best-ranked strategies of the current view.
   It fires only when at least 2 of them signal the same direction within 2 candles and none disagrees. */
export function makeElite(members, mode) {
  return { id: "elite", elite: true, pro: true, members: members.map((m) => m.id), modes: [mode], rr: 1.5, sl: 1.5, warm: Math.max(60, ...members.map((m) => m.warm || 60)),
    fit: mode === "scalp" ? ["scalp", "day"] : mode === "long" ? ["position", "swing"] : ["swing", "day"],
    run(b) {
      const runs = members.map((m) => m.run(b).sig); let lastFire = -99, lastDir = 0;
      const sig = b.map((_, i) => {
        let L = 0, S = 0;
        for (const s of runs) { let l = false, sh = false; for (let j = Math.max(0, i - 2); j <= i; j++) { if (s[j] === 1) l = true; if (s[j] === -1) sh = true; } if (l) L++; if (sh) S++; }
        const d = L >= 2 && !S ? 1 : S >= 2 && !L ? -1 : 0;
        if (!d || (d === lastDir && i - lastFire <= 3)) return 0; lastFire = i; lastDir = d; return d;
      });
      return { sig, lines: members[0] ? members[0].run(b).lines : [] };
    } };
}

export function callFor(bt, bars) {
  const last = bars.length - 1;
  const lt = bt.trades[bt.trades.length - 1];
  const fresh = bt.lastSig >= 0 && last - 1 - bt.lastSig <= 1 && bt.live && bt.live.entryI === bt.lastSig;
  if (fresh) { const d = bt.live.dir; const rev = lt && lt.exitI === bt.lastSig && lt.why === "rev"; return { kind: d === 1 ? "buy" : "sell", fresh: true, futures: rev ? [d === 1 ? "closeShort" : "closeLong", d === 1 ? "openLong" : "openShort"] : [d === 1 ? "openLong" : "openShort"] }; }
  if (bt.live) return { kind: bt.live.dir === 1 ? "holdLong" : "holdShort", fresh: false, futures: [bt.live.dir === 1 ? "holdLong" : "holdShort"] };
  if (lt && last - lt.exitI <= 3) return { kind: lt.why === "tp" ? "tpHit" : lt.why === "be" ? "beHit" : "slHit", fresh: false, futures: ["stayFlat"], trade: lt };
  return { kind: "wait", fresh: false, futures: ["stayFlat"] };
}
