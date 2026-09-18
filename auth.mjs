// Password hashing and session-cookie helpers shared by server.mjs and the
// Worker build produced by build.mjs. Uses only the global Web Crypto API
// (crypto.subtle, crypto.getRandomValues) so the exact same code runs
// unchanged in Node.js 20+ and in Cloudflare Workers.

const PBKDF2_ITERATIONS = 100000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function toHex(bytes) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(hex.substr(index * 2, 2), 16);
  return bytes;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256));
}

// Surrounding whitespace is stripped on both hashing and verification so a
// password pasted with a stray space still matches the one that was stored.
function normalizePassword(password) {
  return String(password).trim();
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(normalizePassword(password), salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const expected = fromHex(parts[3]);
  const actual = await deriveBits(normalizePassword(password), fromHex(parts[2]), iterations);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}

function randomSecretHex() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hmacKey(secretHex) {
  return crypto.subtle.importKey('raw', fromHex(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signSession(payload, secretHex) {
  const data = encoder.encode(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secretHex), data));
  return `${toBase64Url(data)}.${toBase64Url(signature)}`;
}

async function verifySession(cookieValue, secretHex) {
  if (typeof cookieValue !== 'string' || !cookieValue.includes('.')) return null;
  const [dataPart, signaturePart] = cookieValue.split('.');
  try {
    const data = fromBase64Url(dataPart);
    const signature = fromBase64Url(signaturePart);
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secretHex), signature, data);
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(data));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(part.slice(separator + 1).trim()); } catch { result[key] = part.slice(separator + 1).trim(); }
  }
  return result;
}

function serializeCookie(name, value, { maxAge, secure } = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAge != null) segments.push(`Max-Age=${maxAge}`);
  if (secure) segments.push('Secure');
  return segments.join('; ');
}

export {
  SESSION_TTL_MS,
  hashPassword,
  verifyPassword,
  randomSecretHex,
  signSession,
  verifySession,
  parseCookies,
  serializeCookie,
};

// Private records must never be accessible through a user-selected match room.
function isReservedRoom(room) {
  return ['authsecret', 'admins', 'teamcredentials', 'teamcatalog', 'operations'].includes(String(room).toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function validSetupToken(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || expected.length < 32 || candidate.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export { isReservedRoom, validSetupToken };
