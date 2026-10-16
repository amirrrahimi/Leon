// KuCoin: spot (api.kucoin.com) + USDT-M futures (api-futures.kucoin.com). API key v2 (passphrase is signed).
import { hmacB64 } from "../crypto";
import { qs, floorStep, call, cached, cid } from "./util";
const H = (m) => (m === "spot" ? "https://api.kucoin.com" : "https://api-futures.kucoin.com");
const ok = (d, s) => (d?.code !== "200000" ? d?.msg || `HTTP ${s}` : null);
async function req(c, m, method, path, params = {}) {
  const ts = String(Date.now()); const isGet = method === "GET" || method === "DELETE";
  const q = isGet ? qs(params) : ""; const full = path + (q ? "?" + q : ""); const body = isGet ? "" : JSON.stringify(params);
  const sign = await hmacB64(c.secret, ts + method + full + body);
  const pass = await hmacB64(c.secret, c.pass);
  return call("KuCoin", { url: H(m) + full, method, body: isGet ? undefined : body,
    headers: { "KC-API-KEY": c.key, "KC-API-SIGN": sign, "KC-API-TIMESTAMP": ts, "KC-API-PASSPHRASE": pass, "KC-API-KEY-VERSION": "2", "Content-Type": "application/json" } }, ok);
}
const fsym = (sym) => (sym === "BTC" ? "XBT" : sym) + "USDTM";
async function rules(sym, m) {
  return cached(`kc${m}${sym}`, async () => {
    if (m === "spot") { const d = (await call("KuCoin", { url: `${H(m)}/api/v2/symbols/${sym}-USDT` }, ok)).data; if (!d) throw new Error(`KuCoin: ${sym}-USDT not listed`); return { step: d.baseIncrement, min: +d.baseMinSize, qstep: d.quoteIncrement }; }
    const d = (await call("KuCoin", { url: `${H(m)}/api/v1/contracts/${fsym(sym)}` }, ok)).data; if (!d) throw new Error(`KuCoin: ${fsym(sym)} not listed`);
    return { step: d.lotSize || 1, min: 1, mult: +d.multiplier };
  });
}
async function spotFree(c, ccy) { const d = await req(c, "spot", "GET", "/api/v1/accounts", { currency: ccy, type: "trade" }); return +(d.data[0]?.available || 0); }
export default {
  id: "kucoin", name: "KuCoin", markets: ["spot", "futures"], testnet: false, pass: true,
  async balance(c, m) { if (m === "spot") return spotFree(c, "USDT"); const d = await req(c, m, "GET", "/api/v1/account-overview", { currency: "USDT" }); return +(d.data?.availableBalance || 0); },
  async open(c, { sym, market, dir, usdt, lev, price }) {
    const R = await rules(sym, market);
    if (market === "spot") { const r = await req(c, market, "POST", "/api/v1/orders", { clientOid: cid(), side: "buy", symbol: `${sym}-USDT`, type: "market", funds: floorStep(usdt, R.qstep) }); return { id: r.data.orderId, qty: usdt / price }; }
    const size = Math.floor(usdt / price / R.mult); if (size < 1) throw new Error(`KuCoin: order below 1 contract (${R.mult} ${sym})`);
    const r = await req(c, market, "POST", "/api/v1/orders", { clientOid: cid(), side: dir === 1 ? "buy" : "sell", symbol: fsym(sym), type: "market", leverage: String(lev), size, marginMode: "ISOLATED" });
    return { id: r.data.orderId, qty: size * R.mult };
  },
  async close(c, { sym, market, qty }) {
    if (market === "spot") {
      const R = await rules(sym, market); const free = await spotFree(c, sym);
      const q = floorStep(Math.min(qty, free), R.step); if (+q < R.min) return { id: null, skipped: true };
      const r = await req(c, market, "POST", "/api/v1/orders", { clientOid: cid(), side: "sell", symbol: `${sym}-USDT`, type: "market", size: q }); return { id: r.data.orderId };
    }
    const p = (await req(c, market, "GET", "/api/v1/position", { symbol: fsym(sym) })).data;
    if (!p || !+p.currentQty) return { id: null, skipped: true };
    const r = await req(c, market, "POST", "/api/v1/orders", { clientOid: cid(), symbol: fsym(sym), type: "market", closeOrder: true, marginMode: p.marginMode || "ISOLATED" });
    return { id: r.data.orderId };
  },
};
