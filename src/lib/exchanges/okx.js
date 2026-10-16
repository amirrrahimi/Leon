// OKX v5: spot (cash) + USDT perpetual swaps (cross margin, net position mode). Demo trading supported.
import { hmacB64 } from "../crypto";
import { qs, floorStep, px, call, cached } from "./util";
const H = "https://www.okx.com";
const ok = (d, s) => (s >= 400 && !d?.msg ? `HTTP ${s}` : d?.code !== "0" ? (d?.data?.[0]?.sMsg || d?.msg || "error") : null);
async function req(c, method, path, params = {}) {
  const ts = new Date().toISOString(); const isGet = method === "GET";
  const q = isGet ? qs(params) : ""; const full = path + (q ? "?" + q : ""); const body = isGet ? "" : JSON.stringify(params);
  const sign = await hmacB64(c.secret, ts + method + full + body);
  return call("OKX", { url: H + full, method, body: isGet ? undefined : body,
    headers: { "OK-ACCESS-KEY": c.key, "OK-ACCESS-SIGN": sign, "OK-ACCESS-TIMESTAMP": ts, "OK-ACCESS-PASSPHRASE": c.pass, "Content-Type": "application/json", ...(c.testnet ? { "x-simulated-trading": "1" } : {}) } }, ok);
}
const inst = (sym, m) => (m === "spot" ? `${sym}-USDT` : `${sym}-USDT-SWAP`);
async function rules(c, sym, m) {
  return cached(`okx${m}${sym}`, async () => {
    const d = await call("OKX", { url: `${H}/api/v5/public/instruments?instType=${m === "spot" ? "SPOT" : "SWAP"}&instId=${inst(sym, m)}` }, ok);
    const s = d.data[0]; if (!s) throw new Error(`OKX: ${inst(sym, m)} not listed`);
    return { step: s.lotSz, min: +s.minSz, ctVal: +(s.ctVal || 1) };
  });
}
async function bal(c, ccy) { const d = await req(c, "GET", "/api/v5/account/balance", { ccy }); return +(d.data[0]?.details?.find((x) => x.ccy === ccy)?.availBal || 0); }
export default {
  id: "okx", name: "OKX", markets: ["spot", "futures"], testnet: true, pass: true,
  balance: (c) => bal(c, "USDT"),
  async open(c, { sym, market, dir, usdt, lev, price, sl, tp, withSLTP }) {
    if (market === "spot") { const r = await req(c, "POST", "/api/v5/trade/order", { instId: inst(sym, market), tdMode: "cash", side: "buy", ordType: "market", sz: usdt.toFixed(2), tgtCcy: "quote_ccy" }); return { id: r.data[0].ordId, qty: usdt / price }; }
    const R = await rules(c, sym, market);
    await req(c, "POST", "/api/v5/account/set-leverage", { instId: inst(sym, market), lever: String(lev), mgnMode: "cross" }).catch(() => {});
    const sz = floorStep(usdt / price / R.ctVal, R.step); if (+sz < R.min) throw new Error(`OKX: order below minimum size (${R.min} contracts)`);
    const r = await req(c, "POST", "/api/v5/trade/order", { instId: inst(sym, market), tdMode: "cross", side: dir === 1 ? "buy" : "sell", ordType: "market", sz,
      ...(withSLTP ? { attachAlgoOrds: [{ tpTriggerPx: px(tp), tpOrdPx: "-1", slTriggerPx: px(sl), slOrdPx: "-1" }] } : {}) });
    return { id: r.data[0].ordId, qty: +sz * R.ctVal };
  },
  async close(c, { sym, market, qty }) {
    if (market === "spot") {
      const R = await rules(c, sym, market); const free = await bal(c, sym);
      const q = floorStep(Math.min(qty, free), R.step); if (+q < R.min) return { id: null, skipped: true };
      const r = await req(c, "POST", "/api/v5/trade/order", { instId: inst(sym, market), tdMode: "cash", side: "sell", ordType: "market", sz: q, tgtCcy: "base_ccy" }); return { id: r.data[0].ordId };
    }
    const p = (await req(c, "GET", "/api/v5/account/positions", { instId: inst(sym, market) })).data.find((x) => +x.pos !== 0);
    if (!p) return { id: null, skipped: true };
    await req(c, "POST", "/api/v5/trade/close-position", { instId: inst(sym, market), mgnMode: p.mgnMode || "cross" });
    return { id: "close" };
  },
};
