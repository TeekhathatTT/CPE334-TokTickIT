import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { getRequesters } from "./requesters.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

import multer from "multer";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // Issue 2: return a simple health JSON used by tests and the frontend.
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(categories);
  } catch (err) {
    console.error("Failed to load categories", err);
    res.status(500).json({ error: "Unable to fetch categories" });
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
