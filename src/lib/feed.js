// Feed adapter (desktop version): real candles from Binance public market data, live via WebSocket.
// No API key needed for prices. Falls back to the simulated feed if a coin isn't listed or the network is blocked.
// 1.3.0: history can be loaded deeper than 1000 candles (paged backwards) so every strategy finds >= 50 recent points.
import { useEffect, useState } from "react";
import { genSeries, tick } from "./market";
export const LIVE = true;
export const PAGE = 1000;          // Binance max candles per request
export const MAX_DEPTH = 12000;    // hard cap: 12 pages
const REST = ["https://data-api.binance.vision", "https://api.binance.com", "https://api.binance.us"];
const WS = ["wss://data-stream.binance.vision/ws", "wss://stream.binance.com:9443/ws", "wss://stream.binance.us:9443/ws"];
const toBar = (k) => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], vlm: +k[5] });
let goodHost = 0;

async function page(sym, tf, limit, endTime) {
  for (let i = 0; i < REST.length; i++) {
    const h = (goodHost + i) % REST.length;
    try {
      const r = await fetch(`${REST[h]}/api/v3/klines?symbol=${sym}USDT&interval=${tf}&limit=${limit}${endTime ? `&endTime=${endTime}` : ""}`);
      if (!r.ok) continue;
      const rows = await r.json();
      if (Array.isArray(rows)) { goodHost = h; return rows.map(toBar); }
    } catch (e) { /* try next host */ }
  }
  return null;
}

export async function loadHistory(sym, tf, limit = 520) {
  const first = await page(sym, tf, Math.min(limit, PAGE));
  if (!first || first.length <= 50) { const b = genSeries(sym, tf, Math.max(520, Math.min(limit, MAX_DEPTH))).bars; b.live = false; b.exhausted = false; return b; }
  let bars = first, exhausted = first.length < Math.min(limit, PAGE);
  while (!exhausted && bars.length < limit) {
    const older = await page(sym, tf, Math.min(PAGE, limit - bars.length), bars[0].t * 1000 - 1);
    if (!older || !older.length) { exhausted = true; break; }
    bars = older.filter((b) => b.t < bars[0].t).concat(bars);
    if (older.length < Math.min(PAGE, limit - (bars.length - older.length))) exhausted = true;
  }
  bars.exhausted = exhausted; // true = the exchange has no older candles for this coin/timeframe
  return bars;
}

export function useMarket(sym, tf, depth = PAGE) {
  const [state, setState] = useState(() => { const b = genSeries(sym, tf).bars; b.live = false; return { key: "", bars: b }; });
  useEffect(() => {
    let alive = true, ws = null, sim = null;
    const key = sym + "|" + tf + "|" + depth;
    const tag = (b, live, ex) => { b.live = live; b.key = key; b.depth = depth; b.exhausted = ex; return b; };
    loadHistory(sym, tf, depth).then((bars) => {
      if (!alive) return;
      if (bars.live === false) {
        let s = genSeries(sym, tf, depth);
        sim = setInterval(() => { s = tick(s); setState({ key, bars: tag(s.bars, false, false) }); }, 1000);
        setState({ key, bars: tag(s.bars.slice(), false, false) });
        return;
      }
      const ex = !!bars.exhausted;
      setState({ key, bars: tag(bars, true, ex) });
      ws = new WebSocket(`${WS[goodHost]}/${sym.toLowerCase()}usdt@kline_${tf}`);
      ws.onmessage = (ev) => {
        const k = JSON.parse(ev.data).k; if (!k) return;
        const bar = { t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, vlm: +k.v };
        setState((st) => {
          const b = st.bars.slice();
          if (b[b.length - 1].t === bar.t) b[b.length - 1] = bar; else if (bar.t > b[b.length - 1].t) { b.push(bar); b.shift(); }
          return { key, bars: tag(b, true, ex) };
        });
      };
    });
    return () => { alive = false; if (ws) ws.close(); if (sim) clearInterval(sim); };
  }, [sym, tf, depth]);
  return state.bars;
}
