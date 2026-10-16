// Toobit: spot (/api/v1/spot) + USDT-M futures (/api/v2/futures, orders sized in USDT with exchange-side SL/TP).
import { hmacHex } from "../crypto";
import { qs, floorStep, px, call, cached, cid } from "./util";
const H = "https://api.toobit.com";
const ok = (d, s) => (s >= 400 || (d && d.code !== undefined && +d.code !== 0 && +d.code !== 200) ? d?.msg || `HTTP ${s}` : null);
async function req(c, method, path, params = {}) {
  const q = qs({ ...params, recvWindow: 10000, timestamp: Date.now() });
  const signed = `${q}&signature=${await hmacHex(c.secret, q)}`;
  const isGet = method === "GET";
  return call("Toobit", { url: H + path + (isGet ? "?" + signed : ""), method, body: isGet ? undefined : signed, headers: { "X-BB-APIKEY": c.key, "Content-Type": "application/x-www-form-urlencoded" } }, ok);
}
const fsym = (sym) => `${sym}-SWAP-USDT`;
async function rules(sym) {
  return cached(`tb${sym}`, async () => {
    const info = await call("Toobit", { url: `${H}/api/v1/exchangeInfo` }, ok);
    const s = info.symbols?.find((x) => x.symbol === sym + "USDT"); if (!s) throw new Error(`Toobit: ${sym}USDT not listed`);
    const f = s.filters.find((x) => x.filterType === "LOT_SIZE"); return { step: f.stepSize, min: +f.minQty };
  });
}
async function spotFree(c, coin) { const a = await req(c, "GET", "/api/v1/account"); const b = (a.balances || []).find((x) => (x.asset || x.coin) === coin); return +(b?.free || 0); }
export default {
  id: "toobit", name: "Toobit", markets: ["spot", "futures"], testnet: false, pass: false,
  async balance(c, m) {
    if (m === "spot") return spotFree(c, "USDT");
    const a = await req(c, "GET", "/api/v1/futures/balance"); const l = Array.isArray(a) ? a : a.data || [];
    const u = l.find((x) => (x.asset || x.coin || x.tokenId) === "USDT") || l[0]; return +(u?.availableBalance ?? u?.balance ?? 0);
  },
  async open(c, { sym, market, dir, usdt, lev, price, sl, tp, withSLTP }) {
    if (market === "spot") { const r = await req(c, "POST", "/api/v1/spot/order", { symbol: sym + "USDT", side: "BUY", type: "MARKET", quantity: usdt.toFixed(2), newClientOrderId: cid() }); return { id: r.orderId, qty: usdt / price }; }
    await req(c, "POST", "/api/v1/futures/leverage", { symbol: fsym(sym), leverage: lev }).catch(() => {});
    const r = await req(c, "POST", "/api/v2/futures/order", { symbol: fsym(sym), side: dir === 1 ? "BUY" : "SELL", positionSide: dir === 1 ? "LONG" : "SHORT", type: "MARKET", valueQuantity: usdt.toFixed(2), newClientOrderId: cid(),
      ...(withSLTP ? { stopLoss: px(sl), takeProfit: px(tp) } : {}) });
    return { id: r.orderId, qty: usdt / price };
  },
  async close(c, { sym, market, qty, dir }) {
    if (market === "spot") {
      const R = await rules(sym); const free = await spotFree(c, sym);
      const q = floorStep(Math.min(qty, free), R.step); if (+q < R.min) return { id: null, skipped: true };
      const r = await req(c, "POST", "/api/v1/spot/order", { symbol: sym + "USDT", side: "SELL", type: "MARKET", quantity: q, newClientOrderId: cid() }); return { id: r.orderId };
    }
    const ps = await req(c, "GET", "/api/v1/futures/positions", { symbol: fsym(sym) }); const list = Array.isArray(ps) ? ps : ps.data || [];
    const p = list.find((x) => +x.position > 0 && (!x.side || x.side === (dir === 1 ? "LONG" : "SHORT"))) || list.find((x) => +x.position > 0);
    if (!p) return { id: null, skipped: true };
    const long = (p.side || (dir === 1 ? "LONG" : "SHORT")) === "LONG";
    const r = await req(c, "POST", "/api/v2/futures/order", { symbol: fsym(sym), side: long ? "SELL" : "BUY", positionSide: long ? "LONG" : "SHORT", type: "MARKET", quantity: p.position, newClientOrderId: cid() });
    return { id: r.orderId };
  },
};
