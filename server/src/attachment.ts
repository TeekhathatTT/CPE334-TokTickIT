import type { Request, Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "./prisma.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
]);

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR ?? "uploads",
);

function getRequesterId(req: Request): number | null {
  const raw = req.header("x-requester-id");

  if (!raw) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function getAttachmentId(req: Request): number | null {
  const id = Number(req.params.id);

  return Number.isInteger(id) && id > 0 ? id : null;
}

async function hasActiveRequester(requesterId: number): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma.requester) {
    return true;
  }
  const requester = await prisma.requester.findFirst({
    where: { id: requesterId, isActive: true },
    select: { id: true },
  });
  return requester !== null;
}

function isAllowedFile(
  filename: string,
  mimeType: string,
) {
  const extension = path
    .extname(filename)
    .toLowerCase();

  return (
    ALLOWED_EXTENSIONS.has(extension) &&
    ALLOWED_TYPES.has(mimeType)
  );
}

export async function addAttachment(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);
  const ticketId = Number(req.params.id);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Ticket not found.",
      },
    });
  }

  try {
    const prisma = getPrisma();

    if (!(await hasActiveRequester(requesterId))) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        requesterId,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Ticket not found.",
        },
      });
    }

    const activeAttachmentCount =
      await prisma.attachment.count({
        where: {
          ticketId,
          removedAt: null,
        },
      });

    if (activeAttachmentCount >= 5) {
      return res.status(400).json({
        error: {
          code: "LIMIT_REACHED",
          message:
            "A ticket may have at most 5 active attachments.",
        },
      });
    }

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "File is required.",
        },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(413).json({
        error: {
          code: "FILE_TOO_LARGE",
          message:
            "Attachment size must not exceed 5 MB.",
        },
      });
    }

    if (
      !isAllowedFile(
        file.originalname,
        file.mimetype,
      )
    ) {
      return res.status(400).json({
        error: {
          code: "UNSUPPORTED_TYPE",
          message:
            "Supported file types are JPG, JPEG, PNG, WEBP, and PDF.",
        },
      });
    }

    await fs.mkdir(UPLOAD_DIR, {
      recursive: true,
    });

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const storedFilename =
      `${crypto.randomUUID()}${extension}`;

    const storedPath = path.join(
      UPLOAD_DIR,
      storedFilename,
    );

    await fs.writeFile(
      storedPath,
      file.buffer,
    );

    const attachment =
      await prisma.attachment.create({
        data: {
          ticketId,
          originalFilename: file.originalname,
          storedFilename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });

    return res.status(201).json({
      data: {
        id: attachment.id,
        originalFilename:
          attachment.originalFilename,
        sizeBytes: attachment.sizeBytes,
        uploadedAt:
          attachment.uploadedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "Failed to add attachment",
      error,
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to add attachment",
      },
    });
  }
}

export async function getAttachment(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);
  const attachmentId = getAttachmentId(req);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  if (!attachmentId) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Attachment not found.",
      },
    });
  }

  try {
    const prisma = getPrisma();

    if (!(await hasActiveRequester(requesterId))) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const attachment =
      await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          ticket: {
            requesterId,
          },
        },
      });

    if (!attachment) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Attachment not found.",
        },
      });
    }

    return res.status(200).json({
      data: {
        id: attachment.id,
        ticketId: attachment.ticketId,
        originalFilename:
          attachment.originalFilename,
        sizeBytes: attachment.sizeBytes,
        uploadedAt:
          attachment.uploadedAt.toISOString(),
        removedAt:
          attachment.removedAt?.toISOString() ?? null,
        removalReason:
          attachment.removalReason ?? null,
      },
    });
  } catch (error) {
    console.error(
      "Failed to load attachment",
      error,
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch attachment",
      },
    });
  }
}

export async function downloadAttachment(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);
  const attachmentId = getAttachmentId(req);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  if (!attachmentId) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Attachment not found.",
      },
    });
  }

  try {
    const prisma = getPrisma();

    if (!(await hasActiveRequester(requesterId))) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const attachment =
      await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          ticket: {
            requesterId,
          },
        },
      });

    if (!attachment) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Attachment not found.",
        },
      });
    }

    if (attachment.removedAt) {
      return res.status(410).json({
        error: {
          code: "GONE",
          message: "Attachment has been removed.",
        },
      });
    }

    const filePath = path.join(
      UPLOAD_DIR,
      attachment.storedFilename,
    );

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Attachment file not found.",
        },
      });
    }

    res.setHeader(
      "Content-Type",
      attachment.mimeType,
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(
        attachment.originalFilename,
      )}"`,
    );

    const file = await fs.readFile(filePath);

    return res.status(200).send(file);
  } catch (error) {
    console.error(
      "Failed to download attachment",
      error,
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to download attachment",
      },
    });
  }
}

export async function removeAttachment(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);
  const attachmentId = getAttachmentId(req);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  if (!attachmentId) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Attachment not found.",
      },
    });
  }

  const reason =
    typeof req.body.reason === "string"
      ? req.body.reason.trim()
      : "";

  if (reason.length < 5 || reason.length > 200) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Removal reason must be between 5 and 200 characters.",
        fields: {
          reason:
            "Removal reason must be between 5 and 200 characters.",
        },
      },
    });
  }

  try {
    const prisma = getPrisma();

    if (!(await hasActiveRequester(requesterId))) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const attachment =
      await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          ticket: {
            requesterId,
          },
        },
      });

    if (!attachment) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Attachment not found.",
        },
      });
    }

    if (attachment.removedAt) {
      return res.status(409).json({
        error: {
          code: "ALREADY_REMOVED",
          message: "Attachment is already removed.",
        },
      });
    }

    const updated =
      await prisma.attachment.update({
        where: {
          id: attachment.id,
        },
        data: {
          removedAt: new Date(),
          removalReason: reason,
        },
      });

    return res.status(200).json({
      data: {
        id: updated.id,
        removedAt:
          updated.removedAt!.toISOString(),
        removalReason:
          updated.removalReason,
      },
    });
  } catch (error) {
    console.error(
      "Failed to remove attachment",
      error,
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to remove attachment",
      },
    });
  }
}