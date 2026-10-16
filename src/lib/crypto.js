// HMAC signing for exchange APIs + an encrypted key vault (AES-GCM, key derived from your PIN with PBKDF2).
// API secrets never leave this device unencrypted; they are only decrypted in memory after you unlock with your PIN.
const enc = new TextEncoder();
const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new Error("WebCrypto unavailable"); return s; };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (buf) => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hmacRaw(secret, msg) {
  const k = await subtle().importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return subtle().sign("HMAC", k, enc.encode(msg));
}
export const hmacHex = async (secret, msg) => hex(await hmacRaw(secret, msg));
export const hmacB64 = async (secret, msg) => b64(await hmacRaw(secret, msg));

const VAULT = "leon-vault";
async function deriveKey(pin, salt) {
  const base = await subtle().importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export const vaultExists = () => { try { return !!localStorage.getItem(VAULT); } catch { return false; } };
export async function vaultSave(pin, data) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  localStorage.setItem(VAULT, JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
}
export async function vaultOpen(pin) {
  const raw = localStorage.getItem(VAULT); if (!raw) return {};
  const { salt, iv, ct } = JSON.parse(raw);
  const key = await deriveKey(pin, unb64(salt));
  try { const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct)); return JSON.parse(new TextDecoder().decode(pt)); }
  catch { throw new Error("wrong-pin"); }
}
export const vaultWipe = () => { try { localStorage.removeItem(VAULT); } catch {} };
