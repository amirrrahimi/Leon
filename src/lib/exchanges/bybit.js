// Bybit v5 (Unified Trading Account): spot + USDT perpetual (linear). Exchange-side SL/TP attached on futures.
import { hmacHex } from "../crypto";
import { qs, floorStep, px, call, cached } from "./util";
const H = (c) => (c.testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com");
const ok = (d, s) => (s >= 400 ? `HTTP ${s}` : d?.retCode !== 0 ? d?.retMsg || "error" : null);
async function req(c, method, path, params = {}) {
  const ts = Date.now(), rw = 10000;
  const isGet = method === "GET"; const payload = isGet ? qs(params) : JSON.stringify(params);
  const sign = await hmacHex(c.secret, `${ts}${c.key}${rw}${payload}`);
  return call("Bybit", { url: `${H(c)}${path}${isGet && payload ? "?" + payload : ""}`, method, body: isGet ? undefined : payload,
    headers: { "X-BAPI-API-KEY": c.key, "X-BAPI-SIGN": sign, "X-BAPI-TIMESTAMP": String(ts), "X-BAPI-RECV-WINDOW": String(rw), "Content-Type": "application/json" } }, ok);
}
const cat = (m) => (m === "spot" ? "spot" : "linear");
async function rules(c, sym, m) {
  return cached(`by${m}${c.testnet}${sym}`, async () => {
    const d = await call("Bybit", { url: `${H(c)}/v5/market/instruments-info?category=${cat(m)}&symbol=${sym}USDT` }, ok);
    const s = d.result.list[0]; if (!s) throw new Error(`Bybit: ${sym}USDT not listed (${m})`);
    return { step: s.lotSizeFilter.qtyStep || s.lotSizeFilter.basePrecision, min: +s.lotSizeFilter.minOrderQty };
  });
}
async function wallet(c, coin) { const d = await req(c, "GET", "/v5/account/wallet-balance", { accountType: "UNIFIED", coin }); const x = d.result.list[0]?.coin?.find((k) => k.coin === coin); return x ? +(x.walletBalance || 0) - +(x.locked || 0) : 0; }
export default {
  id: "bybit", name: "Bybit", markets: ["spot", "futures"], testnet: true, pass: false,
  balance: (c) => wallet(c, "USDT"),
  async open(c, { sym, market, dir, usdt, lev, price, sl, tp, withSLTP }) {
    if (market === "spot") { const r = await req(c, "POST", "/v5/order/create", { category: "spot", symbol: sym + "USDT", side: "Buy", orderType: "Market", qty: usdt.toFixed(2), marketUnit: "quoteCoin" }); return { id: r.result.orderId, qty: usdt / price }; }
    const R = await rules(c, sym, market);
    await req(c, "POST", "/v5/position/set-leverage", { category: "linear", symbol: sym + "USDT", buyLeverage: String(lev), sellLeverage: String(lev) }).catch(() => {});
    const qty = floorStep(usdt / price, R.step); if (+qty < R.min) throw new Error(`Bybit: order below minimum size (${R.min})`);
    const r = await req(c, "POST", "/v5/order/create", { category: "linear", symbol: sym + "USDT", side: dir === 1 ? "Buy" : "Sell", orderType: "Market", qty, ...(withSLTP ? { stopLoss: px(sl), takeProfit: px(tp) } : {}) });
    return { id: r.result.orderId, qty: +qty };
  },
  async close(c, { sym, market, qty }) {
    if (market === "spot") {
      const R = await rules(c, sym, market); const free = await wallet(c, sym);
      const q = floorStep(Math.min(qty, free), R.step); if (+q < R.min) return { id: null, skipped: true };
      const r = await req(c, "POST", "/v5/order/create", { category: "spot", symbol: sym + "USDT", side: "Sell", orderType: "Market", qty: q, marketUnit: "baseCoin" }); return { id: r.result.orderId };
    }
    const p = (await req(c, "GET", "/v5/position/list", { category: "linear", symbol: sym + "USDT" })).result.list.find((x) => +x.size > 0);
    if (!p) return { id: null, skipped: true };
    const r = await req(c, "POST", "/v5/order/create", { category: "linear", symbol: sym + "USDT", side: p.side === "Buy" ? "Sell" : "Buy", orderType: "Market", qty: p.size, reduceOnly: true });
    return { id: r.result.orderId };
  },
};
