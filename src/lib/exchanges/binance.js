// Binance: Spot (/api/v3) + USDT-M Futures (/fapi). One-way position mode expected for futures.
import { hmacHex } from "../crypto";
import { qs, floorStep, call, cached } from "./util";
const H = (c, m) => (m === "spot" ? (c.testnet ? "https://testnet.binance.vision" : "https://api.binance.com") : c.testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com");
const ok = (d, s) => (s >= 400 || (d && d.code && d.code < 0) ? d?.msg || `HTTP ${s}` : null);
async function req(c, m, method, path, params = {}) {
  const q = qs({ ...params, recvWindow: 10000, timestamp: Date.now() });
  const sig = await hmacHex(c.secret, q);
  return call("Binance", { url: `${H(c, m)}${path}?${q}&signature=${sig}`, method, headers: { "X-MBX-APIKEY": c.key } }, ok);
}
const pub = (c, m, path) => call("Binance", { url: H(c, m) + path }, ok);
async function rules(c, sym, m) {
  return cached(`bn${m}${c.testnet}${sym}`, async () => {
    const info = m === "spot" ? await pub(c, m, `/api/v3/exchangeInfo?symbol=${sym}USDT`) : await pub(c, m, `/fapi/v1/exchangeInfo`);
    const s = info.symbols.find((x) => x.symbol === sym + "USDT"); if (!s) throw new Error(`Binance: ${sym}USDT not listed (${m})`);
    const f = s.filters.find((x) => x.filterType === (m === "spot" ? "LOT_SIZE" : "MARKET_LOT_SIZE")) || s.filters.find((x) => x.filterType === "LOT_SIZE");
    return { step: f.stepSize, min: +f.minQty };
  });
}
export default {
  id: "binance", name: "Binance", markets: ["spot", "futures"], testnet: true, pass: false,
  async balance(c, m) {
    if (m === "spot") { const a = await req(c, m, "GET", "/api/v3/account"); const u = a.balances.find((b) => b.asset === "USDT"); return +(u?.free || 0); }
    const a = await req(c, m, "GET", "/fapi/v2/balance"); const u = a.find((b) => b.asset === "USDT"); return +(u?.availableBalance || 0);
  },
  async open(c, { sym, market, dir, usdt, lev, price }) {
    if (market === "spot") {
      const r = await req(c, market, "POST", "/api/v3/order", { symbol: sym + "USDT", side: "BUY", type: "MARKET", quoteOrderQty: usdt.toFixed(2), newOrderRespType: "RESULT" });
      return { id: r.orderId, qty: +r.executedQty || usdt / price };
    }
    const R = await rules(c, sym, market);
    await req(c, market, "POST", "/fapi/v1/leverage", { symbol: sym + "USDT", leverage: lev }).catch(() => {});
    const qty = floorStep(usdt / price, R.step); if (+qty < R.min) throw new Error(`Binance: order below minimum size (${R.min})`);
    const r = await req(c, market, "POST", "/fapi/v1/order", { symbol: sym + "USDT", side: dir === 1 ? "BUY" : "SELL", type: "MARKET", quantity: qty });
    return { id: r.orderId, qty: +qty };
  },
  async close(c, { sym, market, qty }) {
    if (market === "spot") {
      const R = await rules(c, sym, market);
      const a = await req(c, market, "GET", "/api/v3/account"); const free = +(a.balances.find((b) => b.asset === sym)?.free || 0);
      const q = floorStep(Math.min(qty, free), R.step); if (+q < R.min) return { id: null, skipped: true };
      const r = await req(c, market, "POST", "/api/v3/order", { symbol: sym + "USDT", side: "SELL", type: "MARKET", quantity: q }); return { id: r.orderId };
    }
    const p = (await req(c, market, "GET", "/fapi/v2/positionRisk", { symbol: sym + "USDT" })).find((x) => +x.positionAmt !== 0);
    if (!p) return { id: null, skipped: true };
    const amt = +p.positionAmt;
    const r = await req(c, market, "POST", "/fapi/v1/order", { symbol: sym + "USDT", side: amt > 0 ? "SELL" : "BUY", type: "MARKET", quantity: String(Math.abs(amt)), reduceOnly: "true" });
    return { id: r.orderId };
  },
};
