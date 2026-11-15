import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Parola özeti: scrypt (N=2^15, r=8, p=3 — OWASP önerisi).
 * Biçim: scrypt$N$r$p$tuz$özet  (parametreler ileride yükseltilebilsin diye saklanır)
 */
const N = 1 << 15;
const R = 8;
const P = 3;
const KEY_LEN = 32;

function scryptAsync(password: string, salt: Buffer, keyLen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function options(n: number, r: number, p: number): ScryptOptions {
  return { N: n, r, p, maxmem: 256 * n * r };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, options(N, R, P));
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 1 << 14 || n > 1 << 20 || r < 1 || r > 16 || p < 1 || p > 8) return false;
  const salt = Buffer.from(parts[4]!, "base64url");
  const expected = Buffer.from(parts[5]!, "base64url");
  if (expected.length === 0) return false;
  try {
    const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, options(n, r, p));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Hesap bulunamadığında da aynı süre harcansın diye kullanılan sahte özet. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("anahtar-dummy-password");
  await verifyPassword(password, await dummyHash);
}

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 8) return { ok: false, error: "Şifre en az 8 karakter olmalı." };
  if (password.length > 200) return { ok: false, error: "Şifre çok uzun." };
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return { ok: false, error: "Şifre en az bir harf ve bir rakam içermeli." };
  }
  return { ok: true };
}

/** Okunması kolay (0/O, 1/l karışmayan) geçici şifre üretir: "kmt7-pq4x-9wre". */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let part = "";
    for (let i = 0; i < 4; i++) part += all[randomInt(all.length)];
    groups.push(part);
  }
  // Her zaman en az bir harf ve bir rakam içersin.
  groups[0] = letters[randomInt(letters.length)]! + groups[0]!.slice(1);
  groups[2] = groups[2]!.slice(0, 3) + digits[randomInt(digits.length)]!;
  return groups.join("-");
}
