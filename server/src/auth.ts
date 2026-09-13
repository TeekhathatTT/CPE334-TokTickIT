import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getPrisma } from "./prisma.js";

const COOKIE = "toktickit_session";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export type AuthenticatedUser = { id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean; mustChangePassword: boolean; legacyRequesterId: number | null };
declare global { namespace Express { interface Request { authUser?: AuthenticatedUser } } }
function cookieValue(req: Request) { const raw = req.header("cookie") ?? ""; const item = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`)); return item?.slice(COOKIE.length + 1) ?? null; }
export function safeUser(user: AuthenticatedUser) { return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, mustChangePassword: user.mustChangePassword }; }
export function authError(res: Response, code = "UNAUTHENTICATED", message = "Authentication is required.") { return res.status(401).json({ error: { code, message } }); }
type SessionRecord = { userId: number; createdAt: number; lastSeenAt: number };
const sessionRecords = new Map<string, SessionRecord>();
export async function loadSession(req: Request, _res: Response, next: NextFunction) { const token = cookieValue(req); const session = token ? sessionRecords.get(token) : undefined; const now = Date.now(); if (session && now - session.lastSeenAt <= IDLE_TIMEOUT_MS && now - session.createdAt <= ABSOLUTE_TIMEOUT_MS) { session.lastSeenAt = now; const prisma = getPrisma() as { user?: { findFirst: (args: unknown) => Promise<unknown> } }; if (!prisma.user) return next(); const user = await prisma.user.findFirst({ where: { id: session.userId, isActive: true }, select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, legacyRequesterId: true } }) as AuthenticatedUser | null; if (user) req.authUser = user; else sessionRecords.delete(token as string); } else if (token) sessionRecords.delete(token); next(); }
export function requireAuth(req: Request, res: Response, next: NextFunction) { if (!req.authUser) return authError(res); return next(); }
export function requireRole(...roles: AuthenticatedUser["role"][]) { return (req: Request, res: Response, next: NextFunction) => { if (!req.authUser) return authError(res); if (!roles.includes(req.authUser.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to perform this action." } }); return next(); }; }
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) { if (req.authUser?.mustChangePassword) return res.status(403).json({ error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Password change is required before continuing." } }); return next(); }
export function createSession(userId: number) { const token = crypto.randomBytes(32).toString("hex"); sessionRecords.set(token, { userId, createdAt: Date.now(), lastSeenAt: Date.now() }); return token; }
export function destroySession(req: Request) { const token = cookieValue(req); if (token) sessionRecords.delete(token); }
export function setSessionCookie(res: Response, token: string) { const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""; res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/${secure}`); }
export function clearSessionCookie(res: Response) { res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); }
export function hashPassword(password: string) { const salt = crypto.randomBytes(16).toString("hex"); return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, encoded: string) { const [, salt, expected] = encoded.split(":"); if (!salt || !expected) return false; const actual = crypto.scryptSync(password, salt, 64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")); }
export function validPassword(password: unknown) { return typeof password === "string" && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password); }