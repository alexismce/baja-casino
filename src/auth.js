import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function validateCredentials({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return "Password must be 12–128 characters long.";
  }
  if (displayName !== undefined && (
    typeof displayName !== "string"
    || displayName.trim().length < 3
    || displayName.trim().length > 20
    || !/^[A-Za-z0-9 _-]+$/.test(displayName.trim())
  )) {
    return "Display name must be 3–20 characters using letters, numbers, spaces, _ or -.";
  }
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return { salt: salt.toString("hex"), hash: Buffer.from(hash).toString("hex") };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH, SCRYPT_OPTIONS));
  return timingSafeEqual(actual, expected);
}
