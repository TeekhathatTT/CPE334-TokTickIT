import type { Request, Response } from "express";
import { getRequesterDashboard, getStaffDashboard } from "./dashboards.service.js";

function getRequesterIdFromSession(req: Request): number | null {
  // Session user id is the authenticated actor
  const user = (req as any).user as { id: number; role: string } | undefined;
  if (!user?.id) return null;
  return user.id;
}

export async function getRequesterDashboardHandler(req: Request, res: Response) {
  if (!(req as any).user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
  }
  if ((req as any).user.role !== "REQUESTER") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to perform this action." } });
  }
  try {
    const userId = getRequesterIdFromSession(req);
    if (!userId) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    }
    const data = await getRequesterDashboard(userId);
    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to load requester dashboard", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unable to load dashboard" } });
  }
}

export async function getStaffDashboardHandler(req: Request, res: Response) {
  if (!(req as any).user) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
  }
  const role = (req as any).user.role;
  if (role !== "IT_STAFF" && role !== "ADMINISTRATOR") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to perform this action." } });
  }
  try {
    const userId = getRequesterIdFromSession(req);
    if (!userId) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    }
    const data = await getStaffDashboard(userId);
    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to load staff dashboard", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unable to load dashboard" } });
  }
}
