import type { Request, Response } from "express";
import { getPrisma } from "./prisma.js";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

function getRequesterId(req: Request): number | null {
  const raw = req.header("x-requester-id");

  if (!raw) {
    return null;
  }

  const requesterId = Number(raw);

  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    return null;
  }

  return requesterId;
}

async function getActiveRequester(requesterId: number) {
  const prisma = getPrisma();

  return prisma.requester.findFirst({
    where: {
      id: requesterId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

function validationError(
  res: Response,
  message: string,
  fields?: Record<string, string>,
) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function parsePositiveInt(value: unknown): number | null {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function getCurrentYear() {
  return new Date().getUTCFullYear();
}

async function generateTicketNumber(): Promise<string> {
  const prisma = getPrisma();
  const year = getCurrentYear();

  const prefix = `TKT-${year}-`;

  const latestTicket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      ticketNumber: "desc",
    },
    select: {
      ticketNumber: true,
    },
  });

  let sequence = 1;

  if (latestTicket) {
    const currentSequence = Number(
      latestTicket.ticketNumber.slice(prefix.length),
    );

    if (Number.isInteger(currentSequence)) {
      sequence = currentSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

export async function getRelatedSystems(
  _req: Request,
  res: Response,
) {
  try {
    const prisma = getPrisma();

    const systems = await prisma.relatedSystem.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    return res.status(200).json({
      data: systems,
    });
  } catch (error) {
    console.error("Failed to load related systems", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch related systems",
      },
    });
  }
}

export async function createTicket(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  try {
    const requester = await getActiveRequester(requesterId);

    if (!requester) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const categoryId = parsePositiveInt(
      req.body.categoryId,
    );

    const relatedSystemId = parsePositiveInt(
      req.body.relatedSystemId,
    );

    const summary =
      typeof req.body.summary === "string"
        ? req.body.summary.trim()
        : "";

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    const requestedPriority =
      req.body.requestedPriority;

    const fields: Record<string, string> = {};

    if (!categoryId) {
      fields.categoryId =
        "Category is required.";
    }

    if (!relatedSystemId) {
      fields.relatedSystemId =
        "Related System is required.";
    }

    if (
      summary.length < 5 ||
      summary.length > 120
    ) {
      fields.summary =
        "Summary must be between 5 and 120 characters.";
    }

    if (
      description.length < 10 ||
      description.length > 2000
    ) {
      fields.description =
        "Description must be between 10 and 2000 characters.";
    }

    if (
      !PRIORITIES.includes(
        requestedPriority,
      )
    ) {
      fields.requestedPriority =
        "Requested Priority must be LOW, MEDIUM, or HIGH.";
    }

    if (Object.keys(fields).length > 0) {
      return validationError(
        res,
        "Please correct the invalid fields.",
        fields,
      );
    }

    const prisma = getPrisma();

    const [category, relatedSystem] =
      await Promise.all([
        prisma.category.findFirst({
          where: {
            id: categoryId!,
            isActive: true,
          },
        }),

        prisma.relatedSystem.findFirst({
          where: {
            id: relatedSystemId!,
            isActive: true,
          },
        }),
      ]);

    if (!category) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Category not found.",
        },
      });
    }

    if (!relatedSystem) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Related System not found.",
        },
      });
    }

    const ticketNumber =
      await generateTicketNumber();

    /*
     * Create the Ticket first.
     *
     * If Ticket creation itself fails, the catch block returns 500
     * and no Ticket is returned to the client.
     */
    const ticket =
      await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary,
          description,
          requestedPriority,
          status: "NEW",
        },
      });

    const files = Array.isArray(req.files)
      ? req.files
      : [];

    const attachmentResults: Array<{
      id?: number;
      originalFilename: string;
      sizeBytes: number;
      uploadFailed: boolean;
      reason?: string;
    }> = [];

    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);

    const allowedExtensions = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".pdf",
    ]);

    const maxFileSize =
      5 * 1024 * 1024;

    const uploadDir =
      process.env.UPLOAD_DIR ??
      "uploads";

    const fs =
      await import("node:fs/promises");

    const path =
      await import("node:path");

    const crypto =
      await import("node:crypto");

    const uploadPath =
      path.resolve(uploadDir);

    await fs.mkdir(uploadPath, {
      recursive: true,
    });

    /*
     * Process every attachment independently.
     *
     * A failed attachment is recorded in the response,
     * but does NOT cause the Ticket creation to fail.
     */
    for (const file of files) {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      if (
        !allowedMimeTypes.has(
          file.mimetype,
        )
      ) {
        attachmentResults.push({
          originalFilename:
            file.originalname,
          sizeBytes: file.size,
          uploadFailed: true,
          reason:
            "Unsupported file type.",
        });

        continue;
      }

      if (
        !allowedExtensions.has(
          extension,
        )
      ) {
        attachmentResults.push({
          originalFilename:
            file.originalname,
          sizeBytes: file.size,
          uploadFailed: true,
          reason:
            "Unsupported file type.",
        });

        continue;
      }

      if (
        file.size > maxFileSize
      ) {
        attachmentResults.push({
          originalFilename:
            file.originalname,
          sizeBytes: file.size,
          uploadFailed: true,
          reason:
            "File exceeds the 5MB limit.",
        });

        continue;
      }

      const storedFilename =
        `${crypto.randomUUID()}${extension}`;

      const storedPath =
        path.join(
          uploadPath,
          storedFilename,
        );

      try {
        await fs.writeFile(
          storedPath,
          file.buffer,
        );

        const attachment =
          await prisma.attachment.create({
            data: {
              ticketId: ticket.id,
              originalFilename:
                file.originalname,
              storedFilename,
              mimeType:
                file.mimetype,
              sizeBytes:
                file.size,
            },
          });

        attachmentResults.push({
          id: attachment.id,
          originalFilename:
            attachment.originalFilename,
          sizeBytes:
            attachment.sizeBytes,
          uploadFailed: false,
        });
      } catch (attachmentError) {
        console.error(
          "Attachment upload failed",
          attachmentError,
        );

        /*
         * Clean up the physical file if it was written
         * but the database insert failed.
         */
        try {
          await fs.unlink(
            storedPath,
          );
        } catch {
          // Ignore cleanup failure.
        }

        attachmentResults.push({
          originalFilename:
            file.originalname,
          sizeBytes: file.size,
          uploadFailed: true,
          reason:
            "Attachment storage failed.",
        });
      }
    }

    return res.status(201).json({
      data: {
        id: ticket.id,
        ticketNumber:
          ticket.ticketNumber,
        requesterId:
          ticket.requesterId,
        categoryId:
          ticket.categoryId,
        relatedSystemId:
          ticket.relatedSystemId,
        summary:
          ticket.summary,
        description:
          ticket.description,
        requestedPriority:
          ticket.requestedPriority,
        itPriority:
          ticket.itPriority,
        status:
          ticket.status,
        createdAt:
          ticket.createdAt.toISOString(),
        attachments:
          attachmentResults,
      },
    });
  } catch (error) {
    console.error(
      "Failed to create ticket",
      error,
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to create ticket",
      },
    });
  }
}

export async function getTickets(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  try {
    const requester = await getActiveRequester(requesterId);

    if (!requester) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const categoryId = parsePositiveInt(req.query.category);

    const requestedPriority = PRIORITIES.includes(
      req.query.requestedPriority as (typeof PRIORITIES)[number],
    )
      ? (req.query.requestedPriority as (typeof PRIORITIES)[number])
      : undefined;

    const itPriority = PRIORITIES.includes(
      req.query.itPriority as (typeof PRIORITIES)[number],
    )
      ? (req.query.itPriority as (typeof PRIORITIES)[number])
      : undefined;

    const allowedStatuses = [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "PENDING",
    ] as const;

    const status = allowedStatuses.includes(
      req.query.status as (typeof allowedStatuses)[number],
    )
      ? (req.query.status as (typeof allowedStatuses)[number])
      : undefined;

    const allowedSorts = [
      "createdAt",
      "updatedAt",
      "ticketNumber",
    ] as const;

    const sort = allowedSorts.includes(
      req.query.sort as (typeof allowedSorts)[number],
    )
      ? (req.query.sort as (typeof allowedSorts)[number])
      : "createdAt";

    const order =
      req.query.order === "asc" ? "asc" : "desc";

    const parsedPage = Number(req.query.page);
    const page =
      Number.isInteger(parsedPage) && parsedPage >= 1
        ? parsedPage
        : 1;

    const requestedPageSize = Number(req.query.pageSize);

    const pageSize =
      requestedPageSize === 20 || requestedPageSize === 50
        ? requestedPageSize
        : 10;

    const where = {
      requesterId,
      ...(categoryId ? { categoryId } : {}),
      ...(requestedPriority
        ? { requestedPriority }
        : {}),
      ...(itPriority ? { itPriority } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              {
                ticketNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                summary: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const prisma = getPrisma();

    const totalItems = await prisma.ticket.count({
      where,
    });

    const totalAllTickets = await prisma.ticket.count({
      where: {
        requesterId,
      },
    });

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(totalItems / pageSize);

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        requestedPriority: true,
        itPriority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        [sort]: order,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return res.status(200).json({
      data: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        summary: ticket.summary,
        category: ticket.category.name,
        requestedPriority: ticket.requestedPriority,
        itPriority: ticket.itPriority,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
        isEmpty: totalAllTickets === 0,
        isNoResults:
          totalAllTickets > 0 && totalItems === 0,
      },
    });
  } catch (error) {
    console.error("Failed to load tickets", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch tickets",
      },
    });
  }
}

export async function getTicket(
  req: Request,
  res: Response,
) {
  const requesterId = getRequesterId(req);
  const ticketId = parsePositiveInt(req.params.id);

  if (!requesterId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Valid x-requester-id is required.",
      },
    });
  }

  if (!ticketId) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Ticket not found.",
      },
    });
  }

  try {
    const requester = await getActiveRequester(requesterId);

    if (!requester) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid x-requester-id is required.",
        },
      });
    }

    const prisma = getPrisma();

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        requesterId,
      },
      include: {
        requester: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        relatedSystem: {
          select: {
            name: true,
          },
        },
        attachments: {
          orderBy: {
            id: "asc",
          },
        },
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

    return res.status(200).json({
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        createdAt: ticket.createdAt.toISOString(),
        category: ticket.category.name,
        relatedSystem: ticket.relatedSystem.name,
        requester: ticket.requester.name,
        requestedPriority: ticket.requestedPriority,
        itPriority: ticket.itPriority,
        status: ticket.status,
        ticketOwner: ticket.ticketOwnerId,
        summary: ticket.summary,
        description: ticket.description,
        attachments: {
          active: ticket.attachments
            .filter((attachment) => !attachment.removedAt)
            .map((attachment) => ({
              id: attachment.id,
              originalFilename: attachment.originalFilename,
              sizeBytes: attachment.sizeBytes,
              uploadedAt: attachment.uploadedAt.toISOString(),
            })),
          removed: ticket.attachments
            .filter((attachment) => attachment.removedAt)
            .map((attachment) => ({
              id: attachment.id,
              originalFilename: attachment.originalFilename,
              sizeBytes: attachment.sizeBytes,
              removedAt:
                attachment.removedAt!.toISOString(),
              removalReason: attachment.removalReason,
            })),
        },
      },
    });
  } catch (error) {
    console.error("Failed to load ticket", error);

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch ticket",
      },
    });
  }
}