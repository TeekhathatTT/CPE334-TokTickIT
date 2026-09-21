import type { Request, Response } from "express";
import { hashPassword, validPassword } from "./auth.js";
import { getPrisma } from "./prisma.js";

const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
type Role = (typeof ROLES)[number];

function idFrom(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function roleFrom(value: unknown): Role | null {
  return typeof value === "string" && ROLES.includes(value as Role) ? value as Role : null;
}

function emailFrom(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function sendValidation(res: Response, message: string, fields?: Record<string, string>) {
  return res.status(400).json({ error: { code: "VALIDATION_ERROR", message, ...(fields ? { fields } : {}) } });
}

function mapUser(user: { id: number; name: string; email: string; role: Role; isActive: boolean; mustChangePassword: boolean; createdAt: Date; updatedAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}

const userSelect = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;

export async function listUsers(req: Request, res: Response) {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const role = req.query.role === undefined ? null : roleFrom(req.query.role);
  if (search.length > 120 || (req.query.role !== undefined && !role)) {
    return sendValidation(res, "One or more query parameters are invalid.", {
      ...(search.length > 120 ? { search: "Search must be 120 characters or fewer." } : {}),
      ...(req.query.role !== undefined && !role ? { role: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR." } : {}),
    });
  }
  const where: { role?: Role; OR?: Array<object> } = {};
  if (role) where.role = role;
  if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];
  const users = await getPrisma().user.findMany({ where, select: userSelect, orderBy: [{ name: "asc" }, { id: "asc" }] });
  return res.status(200).json({ data: users.map(mapUser) });
}

export async function createUser(req: Request, res: Response) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = emailFrom(req.body?.email);
  const role = roleFrom(req.body?.role);
  const isActive = req.body?.isActive;
  const initialPassword = req.body?.initialPassword;
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || !role || typeof isActive !== "boolean" || !validPassword(initialPassword)) {
    return sendValidation(res, "One or more user fields are invalid.", {
      ...(!name || name.length > 120 ? { name: "Name is required and must be 120 characters or fewer." } : {}),
      ...(!/^\S+@\S+\.\S+$/.test(email) ? { email: "A valid email is required." } : {}),
      ...(!role ? { role: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR." } : {}),
      ...(typeof isActive !== "boolean" ? { isActive: "Active status must be true or false." } : {}),
      ...(!validPassword(initialPassword) ? { initialPassword: "Password must meet the required rules." } : {}),
    });
  }
  try {
    const user = await getPrisma().user.create({ data: { name, email, role, isActive, passwordHash: hashPassword(initialPassword), mustChangePassword: true }, select: userSelect });
    return res.status(201).json({ data: mapUser(user) });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return res.status(409).json({ error: { code: "EMAIL_CONFLICT", message: "An account with this email already exists." } });
    throw error;
  }
}

export async function updateUser(req: Request, res: Response) {
  const id = idFrom(req.params.id);
  if (!id) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  const body = req.body ?? {};
  const keys = ["name", "email", "role", "isActive"];
  if (!Object.keys(body).some((key) => keys.includes(key))) return sendValidation(res, "At least one editable user field is required.");
  const data: { name?: string; email?: string; role?: Role; isActive?: boolean } = {};
  if ("name" in body) { const name = typeof body.name === "string" ? body.name.trim() : ""; if (!name || name.length > 120) return sendValidation(res, "Name is invalid.", { name: "Name is required and must be 120 characters or fewer." }); data.name = name; }
  if ("email" in body) { const email = emailFrom(body.email); if (!/^\S+@\S+\.\S+$/.test(email)) return sendValidation(res, "Email is invalid.", { email: "A valid email is required." }); data.email = email; }
  if ("role" in body) { const role = roleFrom(body.role); if (!role) return sendValidation(res, "Role is invalid.", { role: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR." }); data.role = role; }
  if ("isActive" in body) { if (typeof body.isActive !== "boolean") return sendValidation(res, "Active status is invalid.", { isActive: "Active status must be true or false." }); data.isActive = body.isActive; }

  const prisma = getPrisma();
  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
      if (!existing) return null;
      const removesActiveAdmin = existing.role === "ADMINISTRATOR" && existing.isActive && (data.isActive === false || (data.role !== undefined && data.role !== "ADMINISTRATOR"));
      if (req.authUser!.id === id && data.isActive === false) throw new Error("SELF_DEACTIVATION");
      if (removesActiveAdmin && await tx.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }) <= 1) throw new Error("LAST_ADMIN");
      return tx.user.update({ where: { id }, data, select: userSelect });
    });
    if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
    return res.status(200).json({ data: mapUser(user) });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SELF_DEACTIVATION") return res.status(409).json({ error: { code: "SELF_DEACTIVATION", message: "Administrators cannot deactivate their own account." } });
    if (error instanceof Error && error.message === "LAST_ADMIN") return res.status(409).json({ error: { code: "LAST_ACTIVE_ADMIN", message: "At least one active Administrator must remain." } });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return res.status(409).json({ error: { code: "EMAIL_CONFLICT", message: "An account with this email already exists." } });
    throw error;
  }
}

export async function resetInitialPassword(req: Request, res: Response) {
  const id = idFrom(req.params.id);
  const initialPassword = req.body?.initialPassword;
  if (!id) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  if (!validPassword(initialPassword)) return sendValidation(res, "Password does not meet the required rules.", { initialPassword: "Password must be at least 8 characters and include upper/lower case, a number, and a special character." });
  try {
    const user = await getPrisma().user.update({ where: { id }, data: { passwordHash: hashPassword(initialPassword), mustChangePassword: true }, select: userSelect });
    return res.status(200).json({ data: mapUser(user) });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2025") return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
    throw error;
  }
}
