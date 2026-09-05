import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { getRequesters } from "./requesters.js";
import {
  createTicket,
  getRelatedSystems,
  getTicket,
  getTickets,
} from "./ticket.js";
import {
  addAttachment,
  getAttachment,
  downloadAttachment,
  removeAttachment,
} from "./attachment.js";

void getPrisma;

export const app = express();

app.use(cors());
app.use(express.json());

/*
 * Do not use multer fileSize/files limits here.
 *
 * BR-16 requires POST /api/tickets to support partial success:
 * invalid attachments must not reject the whole Ticket creation.
 *
 * Individual attachment validation is handled inside createTicket().
 */
const upload = multer({
  storage: multer.memoryStorage(),
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.status(200).json({
      data: categories,
    });
  } catch (error) {
    console.error("Failed to load categories", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch categories",
      },
    });
  }
});

app.get("/api/requesters", getRequesters);

app.get(
  "/api/related-systems",
  getRelatedSystems,
);

app.post(
  "/api/tickets",
  upload.array("attachments", 5),
  createTicket,
);

app.get(
  "/api/tickets",
  getTickets,
);

app.get(
  "/api/tickets/:id",
  getTicket,
);

app.post(
  "/api/tickets/:id/attachments",
  upload.single("file"),
  addAttachment,
);

app.get(
  "/api/attachments/:id",
  getAttachment,
);

app.get(
  "/api/attachments/:id/download",
  downloadAttachment,
);

app.patch(
  "/api/attachments/:id/remove",
  removeAttachment,
);

export default app;