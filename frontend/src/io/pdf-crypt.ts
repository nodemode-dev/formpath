const PAD = Uint8Array.from([0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a]);

const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

export function md5(data: Uint8Array): Uint8Array {
  const n = data.length, total = ((n + 8) >> 6 << 6) + 64, buf = new Uint8Array(total), dv = new DataView(buf.buffer);
  buf.set(data);
  buf[n] = 0x80;
  dv.setUint32(total - 8, (n << 3) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(n / 536870912), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Array<number>(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return out;
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255; j = (j + s[i]) & 255;
    const t = s[i]; s[i] = s[j]; s[j] = t;
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const cat = (...p: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(p.reduce((a, x) => a + x.length, 0));
  let o = 0;
  for (const x of p) { out.set(x, o); o += x.length; }
  return out;
};
const same = (a: Uint8Array, b: Uint8Array, n: number): boolean => {
  if (a.length < n || b.length < n) return false;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
};
const buf = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

function padded(pw: Uint8Array): Uint8Array { return cat(pw.subarray(0, 32), PAD).subarray(0, 32); }

async function sha(bits: 256 | 384 | 512, b: Uint8Array): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.digest(`SHA-${bits}`, buf(b))); }

async function cbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, padding: boolean): Promise<Uint8Array> {
  if (!data.length) return data;
  const k = await crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['decrypt', 'encrypt']);
  if (padding) {
    try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf(iv) }, k, buf(data))); } catch { /* damaged padding: decrypt unpadded below */ }
  }
  const whole = data.subarray(0, data.length - (data.length % 16));
  if (!whole.length) return new Uint8Array();
  const last = whole.subarray(whole.length - 16), pad = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(last) }, k, new Uint8Array()));
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf(iv) }, k, buf(cat(whole, pad.subarray(0, 16)))));
  if (!padding) return plain;
  const p = plain[plain.length - 1];
  return p >= 1 && p <= 16 ? plain.subarray(0, plain.length - p) : plain;
}

async function cbcEncryptRaw(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(iv) }, k, buf(data))).subarray(0, data.length);
}

async function hash2B(pw: Uint8Array, salt: Uint8Array, udata: Uint8Array): Promise<Uint8Array> {
  let k = await sha(256, cat(pw, salt, udata));
  for (let i = 0; ; i++) {
    const unit = cat(pw, k, udata), k1 = new Uint8Array(unit.length * 64);
    for (let r = 0; r < 64; r++) k1.set(unit, r * unit.length);
    const e = await cbcEncryptRaw(k.subarray(0, 16), k.subarray(16, 32), k1);
    let mod = 0;
    for (let j = 0; j < 16; j++) mod += e[j];
    k = await sha(([256, 384, 512] as const)[mod % 3], e);
    if (i >= 63 && e[e.length - 1] <= i - 31) break;
  }
  return k.subarray(0, 32);
}

export type CryptMethod = 'None' | 'V2' | 'AESV2' | 'AESV3';

export interface CryptParams {
  v: number;
  r: number;
  length: number;
  o: Uint8Array;
  u: Uint8Array;
  oe: Uint8Array;
  ue: Uint8Array;
  p: number;
  id: Uint8Array;
  encryptMetadata: boolean;
  stm: CryptMethod;
  str: CryptMethod;
}

export class PdfCrypt {
  constructor(private readonly key: Uint8Array, private readonly stm: CryptMethod, private readonly str: CryptMethod, readonly encryptMetadata: boolean) {}

  private objectKey(num: number, gen: number, method: CryptMethod): Uint8Array {
    if (method === 'AESV3') return this.key;
    const ext = Uint8Array.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]);
    const h = md5(method === 'AESV2' ? cat(this.key, ext, Uint8Array.from([0x73, 0x41, 0x6c, 0x54])) : cat(this.key, ext));
    return h.subarray(0, Math.min(this.key.length + 5, 16));
  }

  private async run(num: number, gen: number, data: Uint8Array, method: CryptMethod): Promise<Uint8Array> {
    if (method === 'None') return data;
    const key = this.objectKey(num, gen, method);
    if (method === 'V2') return rc4(key, data);
    if (data.length < 32) return data.length > 16 ? await cbcDecrypt(key, data.subarray(0, 16), data.subarray(16), true).catch(() => new Uint8Array()) : new Uint8Array();
    return cbcDecrypt(key, data.subarray(0, 16), data.subarray(16), true);
  }

  stream(num: number, gen: number, data: Uint8Array): Promise<Uint8Array> { return this.run(num, gen, data, this.stm); }
  string(num: number, gen: number, data: Uint8Array): Promise<Uint8Array> { return this.run(num, gen, data, this.str); }
}

function userKeyLegacy(p: CryptParams, pw: Uint8Array): Uint8Array {
  const n = p.r === 2 ? 5 : Math.max(5, Math.min(16, p.length / 8));
  const pv = new Uint8Array(4);
  new DataView(pv.buffer).setInt32(0, p.p | 0, true);
  let h = md5(cat(padded(pw), p.o.subarray(0, 32), pv, p.id, p.r >= 4 && !p.encryptMetadata ? Uint8Array.from([255, 255, 255, 255]) : new Uint8Array()));
  if (p.r >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
  return h.subarray(0, n);
}

function userOk(p: CryptParams, key: Uint8Array): boolean {
  if (p.r === 2) return same(rc4(key, PAD), p.u, 32);
  let x = rc4(key, md5(cat(PAD, p.id)));
  for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x);
  return same(x, p.u, 16);
}

function userFromOwner(p: CryptParams, pw: Uint8Array): Uint8Array {
  const n = p.r === 2 ? 5 : Math.max(5, Math.min(16, p.length / 8));
  let h = md5(padded(pw));
  if (p.r >= 3) for (let i = 0; i < 50; i++) h = md5(h);
  const key = h.subarray(0, n);
  let x = p.o.subarray(0, 32);
  if (p.r === 2) return rc4(key, x);
  for (let i = 19; i >= 0; i--) x = rc4(key.map((b) => b ^ i), x);
  return x;
}

export async function openCrypt(p: CryptParams, password: string): Promise<PdfCrypt | null> {
  if (p.r >= 5) {
    const raw = new TextEncoder().encode(password).subarray(0, 127), hash = async (pw: Uint8Array, salt: Uint8Array, ud: Uint8Array): Promise<Uint8Array> => (p.r === 5 ? sha(256, cat(pw, salt, ud)) : hash2B(pw, salt, ud));
    const u48 = p.u.subarray(0, 48);
    if (same(await hash(raw, p.u.subarray(32, 40), new Uint8Array()), p.u, 32)) {
      const ik = await hash(raw, p.u.subarray(40, 48), new Uint8Array());
      return new PdfCrypt(await cbcDecrypt(ik, new Uint8Array(16), p.ue.subarray(0, 32), false), p.stm, p.str, p.encryptMetadata);
    }
    if (same(await hash(raw, p.o.subarray(32, 40), u48), p.o, 32)) {
      const ik = await hash(raw, p.o.subarray(40, 48), u48);
      return new PdfCrypt(await cbcDecrypt(ik, new Uint8Array(16), p.oe.subarray(0, 32), false), p.stm, p.str, p.encryptMetadata);
    }
    return null;
  }
  const pw = Uint8Array.from(Array.from(password, (c) => c.charCodeAt(0) & 255));
  let key = userKeyLegacy(p, pw);
  if (userOk(p, key)) return new PdfCrypt(key, p.stm, p.str, p.encryptMetadata);
  key = userKeyLegacy(p, userFromOwner(p, pw));
  if (userOk(p, key)) return new PdfCrypt(key, p.stm, p.str, p.encryptMetadata);
  return null;
}
