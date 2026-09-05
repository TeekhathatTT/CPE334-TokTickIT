import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  canAddAttachment,
  validateAttachment,
} from "../src/utils/attachment";

function file(name: string, size = 100) {
  const type = name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return { name, size, type };
}

describe("attachment validation", () => {
  it.each(["photo.jpg", "photo.png", "photo.webp", "document.pdf"])("accepts %s", (name) => {
    expect(validateAttachment(file(name))).toEqual({ accepted: true });
  });

  it("rejects unsupported types", () => {
    expect(validateAttachment(file("program.exe"))).toEqual({ accepted: false, reason: "unsupported" });
  });

  it("rejects an extension and MIME type mismatch", () => {
    expect(validateAttachment({ name: "photo.png", size: 100, type: "application/pdf" })).toEqual({ accepted: false, reason: "unsupported" });
  });

  it("rejects files larger than 5 MB", () => {
    expect(validateAttachment(file("large.pdf", MAX_ATTACHMENT_SIZE_BYTES + 1))).toEqual({ accepted: false, reason: "oversized" });
  });

  it("allows five files and rejects a sixth", () => {
    expect(canAddAttachment(0, 5)).toBe(true);
    expect(canAddAttachment(5)).toBe(false);
  });
});