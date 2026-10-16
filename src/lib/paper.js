// Test account (paper trading): a virtual USDT wallet with a balance you choose.
// Same rules as a real futures account: margin, leverage, taker fee on both sides, liquidation when the margin is gone.
export const PAPER_DEFAULT = { start: 1000, fee: 0.1, lev: 1, market: "futures" };
export function newPaper(start = 1000, fee = 0.1) { return { start: +start, cash: +start, fee: +fee, positions: [], history: [], created: Date.now(), peak: +start }; }
const uid = () => Math.random().toString(36).slice(2, 10);
export const upnl = (p, price) => p.dir * p.qty * (price - p.entry);
export const liqPrice = (p) => (p.lev <= 1 && p.dir === 1 ? 0 : p.entry * (1 - p.dir / p.lev));
export function equity(acc, prices = {}) { return acc.cash + acc.positions.reduce((s, p) => s + p.margin + upnl(p, prices[p.sym] ?? p.last ?? p.entry), 0); }

export function paperOpen(acc, { sym, market, dir, margin, lev, price, sl, tp, src = "manual" }) {
  if (market === "spot") { dir = 1; lev = 1; }
  margin = Math.min(margin, acc.cash / (1 + (acc.fee / 100) * lev));
  if (!(margin > 0.01)) throw new Error("insufficient");
  const notional = margin * lev, fee = notional * (acc.fee / 100);
  const pos = { id: uid(), sym, market, dir, lev, margin, qty: notional / price, entry: price, last: price, sl, sl0: sl, tp, be: false, fees: fee, opened: Date.now(), src };
  return { acc: { ...acc, cash: acc.cash - margin - fee, positions: [...acc.positions, pos] }, pos };
}

export function paperClose(acc, id, price, why = "manual") {
  const p = acc.positions.find((x) => x.id === id); if (!p) return { acc };
  const fee = p.qty * price * (acc.fee / 100);
  let pnl = upnl(p, price); if (why === "liq") pnl = -p.margin;
  const back = Math.max(0, p.margin + pnl - (why === "liq" ? 0 : fee));
  const tr = { ...p, exit: price, closed: Date.now(), why, pnl: back - p.margin - p.fees, pct: (back - p.margin - p.fees) / p.margin };
  const next = { ...acc, cash: acc.cash + back, positions: acc.positions.filter((x) => x.id !== id), history: [tr, ...acc.history].slice(0, 300) };
  next.peak = Math.max(next.peak || next.start, equity(next));
  return { acc: next, trade: tr };
}

// Price tick for one coin: move break-even, then check stop / target / liquidation (stop first = conservative)
export function paperMark(acc, sym, price, hi = price, lo = price) {
  let a = acc; const closed = [];
  for (const p0 of acc.positions.filter((x) => x.sym === sym)) {
    const p = { ...p0, last: price };
    const R = p.sl0 ? Math.abs(p.entry - p.sl0) : 0; const liq = liqPrice(p);
    const hitL = p.dir === 1 ? lo <= liq && liq > 0 : hi >= liq;
    const hitS = p.sl && (p.dir === 1 ? lo <= p.sl : hi >= p.sl), hitT = p.tp && (p.dir === 1 ? hi >= p.tp : lo <= p.tp);
    a = { ...a, positions: a.positions.map((x) => (x.id === p.id ? p : x)) };
    if (hitL && (!hitS || (p.dir === 1 ? liq >= p.sl : liq <= p.sl))) { const r = paperClose(a, p.id, liq, "liq"); a = r.acc; closed.push(r.trade); continue; }
    if (hitS) { const r = paperClose(a, p.id, p.sl, p.be ? "be" : "sl"); a = r.acc; closed.push(r.trade); continue; }
    if (hitT) { const r = paperClose(a, p.id, p.tp, "tp"); a = r.acc; closed.push(r.trade); continue; }
    if (R && !p.be && (p.dir === 1 ? hi >= p.entry + R : lo <= p.entry - R)) a = { ...a, positions: a.positions.map((x) => (x.id === p.id ? { ...p, sl: p.entry, be: true } : x)) };
  }
  return { acc: a, closed };
}

// Strategy test in money: replay the backtest's trades on a chosen balance, size and leverage
export function simulate(bt, { balance = 1000, sizePct = 10, lev = 1, fee = 0.1, market = "futures" }) {
  let eq = +balance, peak = eq, maxDD = 0, wins = 0, losses = 0, liq = 0, n = 0; const curve = [eq];
  for (const t of bt.trades) {
    if (market === "spot" && t.dir !== 1) continue;
    const L = market === "spot" ? 1 : lev; const margin = eq * (sizePct / 100); const notional = margin * L;
    let pnl = notional * t.pnl - notional * (fee / 100) * 2;
    if (t.pnl * L <= -1) { pnl = -margin; liq++; }
    eq = Math.max(0, eq + pnl); n++; if (pnl > 0) wins++; else if (pnl < 0) losses++;
    peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak ? 1 - eq / peak : 0); curve.push(eq);
    if (eq <= 0) break;
  }
  return { final: eq, ret: eq / balance - 1, maxDD, wins, losses, n, liq, curve };
}
