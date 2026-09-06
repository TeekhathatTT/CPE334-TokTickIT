import type { Request, Response } from "express";
import { getPrisma } from "./prisma.js";

export async function getRequesters(_req: Request, res: Response) {
  try {
    const prisma = getPrisma();

    const requesters = await prisma.requester.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
    });

    return res.status(200).json({ data: requesters });
  } catch (error) {
    console.error("Failed to load requesters", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch requesters",
      },
    });
  }
}
