export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const ALLOWED_ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"] as const;
export const ALLOWED_ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type AttachmentRejectionReason = "unsupported" | "oversized" | "limit";

export interface AttachmentValidation {
  accepted: boolean;
  reason?: AttachmentRejectionReason;
}

export function validateAttachment(file: Pick<File, "name" | "size" | "type">): AttachmentValidation {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number])) {
    return { accepted: false, reason: "unsupported" };
  }
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
    return { accepted: false, reason: "unsupported" };
  }
  const expectedMimeType = extension === ".pdf"
    ? "application/pdf"
    : extension === ".webp"
      ? "image/webp"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : "image/png";
  if (file.type !== expectedMimeType) {
    return { accepted: false, reason: "unsupported" };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { accepted: false, reason: "oversized" };
  }
  return { accepted: true };
}

export function canAddAttachment(currentCount: number, incomingCount = 1): boolean {
  return currentCount + incomingCount <= MAX_ATTACHMENTS;
}