// Lab 3 authentication service (spec §4 FR-01/FR-02/FR-03, BR-01/BR-02/BR-06/BR-07/BR-08,
// api-spec.md §1 + §7).
//
// Passwords use scrypt exactly as frozen in specification.md BR-08:
//   crypto.scryptSync(Buffer.from(password, "utf8"), salt, 64,
//     { N: 16384, r: 8, p: 1, maxmem: 32 MiB })
// with a per-password random 16-byte salt, stored as a single self-describing
// TEXT value: `scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>`.
// Verification re-parses N/r/p, recomputes scryptSync, compares with
// crypto.timingSafeEqual. Plaintext is never stored or returned.
//
// Sessions are opaque, server-side, and process-local (api-spec.md §7): a
// random token in an HttpOnly SameSite cookie (`toktickit_session`), expiring
// after 30 minutes idle or 8 hours absolute. A server restart clears all
// sessions (accepted local-lab property, not a bug).

import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "toktickit_session";

// api-spec.md §7: 30 minutes idle or 8 hours absolute, whichever comes first.
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

// specification.md BR-08: frozen scrypt cost parameters.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;
const SCRYPT_SALT_BYTES = 16;

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface SessionSafeUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface SessionUser extends SessionSafeUser {
  legacyRequesterId: number | null;
}

/** BR-18: emails are normalized (trimmed + lowercased) before comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * BR-08 password policy: at least 8 characters with upper- and lower-case
 * letters, a number, and a special character.
 */
export function meetsPasswordPolicy(password: unknown): boolean {
  if (typeof password !== "string" || password.length < 8) return false;
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function passwordPolicyMessage(): string {
  return "Password must be at least 8 characters and include upper-case and lower-case letters, a number, and a special character.";
}

/** BR-08: hash a password into `scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const derived = crypto.scryptSync(
    Buffer.from(password, "utf8"),
    salt,
    SCRYPT_KEY_LEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
  );
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * BR-08: verify a password against a stored `scrypt$...$saltHex$hashHex`
 * value. Returns false (never throws) for malformed stored values so a
 * corrupt row cannot crash authentication.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (typeof password !== "string" || typeof stored !== "string") return false;
    const match = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([0-9a-fA-F]+)\$([0-9a-fA-F]+)$/.exec(
      stored,
    );
    if (!match) return false;
    const [, nRaw, rRaw, pRaw, saltHex, hashHex] = match;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== SCRYPT_SALT_BYTES || expected.length !== SCRYPT_KEY_LEN) {
      return false;
    }
    const derived = crypto.scryptSync(
      Buffer.from(password, "utf8"),
      salt,
      SCRYPT_KEY_LEN,
      {
        N: Number(nRaw),
        r: Number(rRaw),
        p: Number(pRaw),
        maxmem: SCRYPT_MAXMEM,
      },
    );
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Safe user shape returned by login/me/change-password (never a hash). */
export function toSafeUser(user: SessionSafeUser): SessionSafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

// ---------------------------------------------------------------------------
// Opaque server-side session store (process-local, api-spec.md §7).
// ---------------------------------------------------------------------------

interface SessionRecord {
  userId: number;
  createdAt: number;
  lastSeenAt: number;
}

const sessions = new Map<string, SessionRecord>();

/** Issue a new opaque session token for a user id. */
export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(token, { userId, createdAt: now, lastSeenAt: now });
  return token;
}

/**
 * Resolve a session token to its user id, enforcing idle + absolute expiry
 * and refreshing the idle timestamp. Returns null for missing/expired
 * tokens (expired records are purged).
 */
export function getSessionUserId(token: string | null | undefined): number | null {
  if (!token) return null;
  const record = sessions.get(token);
  if (!record) return null;
  const now = Date.now();
  if (
    now - record.lastSeenAt > SESSION_IDLE_TIMEOUT_MS ||
    now - record.createdAt > SESSION_ABSOLUTE_TIMEOUT_MS
  ) {
    sessions.delete(token);
    return null;
  }
  record.lastSeenAt = now;
  return record.userId;
}

/** BR-07: invalidate one session (logout). */
export function destroySession(token: string | null | undefined): void {
  if (token) sessions.delete(token);
}

/**
 * Invalidate every session belonging to a user. Used on password change so
 * a holder of a previous (e.g. temporary) password loses access on all
 * devices — rotating only the current session would leave the others valid.
 */
export function destroySessionsForUser(userId: number): void {
  for (const [token, record] of sessions) {
    if (record.userId === userId) sessions.delete(token);
  }
}

/** Local-lab/test helper: drop every session (e.g. between isolated tests). */
export function clearAllSessions(): void {
  sessions.clear();
}

// ---------------------------------------------------------------------------
// Session cookie helpers (api-spec.md §7).
// ---------------------------------------------------------------------------

/** Extract the session token from a raw `Cookie` header value. */
export function getSessionTokenFromCookieHeader(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const part = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!part) return null;
  const token = part.slice(prefix.length).trim();
  return token ? token : null;
}

function sessionCookieAttributes(maxAgeSeconds?: number): string {
  const segments = ["HttpOnly", "Path=/", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true") {
    segments.push("Secure");
  }
  if (maxAgeSeconds !== undefined) {
    segments.push(`Max-Age=${maxAgeSeconds}`);
  }
  return segments.join("; ");
}

/** Build the `Set-Cookie` value that establishes the session. */
export function buildSetSessionCookie(token: string): string {
  // Cookie lifetime mirrors the absolute server-side expiry (8 hours).
  const maxAge = Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${token}; ${sessionCookieAttributes(maxAge)}`;
}

/** Build the `Set-Cookie` value that clears the session (BR-07). */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${sessionCookieAttributes(0)}`;
}
