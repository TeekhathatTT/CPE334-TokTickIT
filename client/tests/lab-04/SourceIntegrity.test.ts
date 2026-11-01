import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as api from "../../src/api";

const sourceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const sourceExtensions = new Set([".ts", ".tsx", ".css"]);
const mojibakePattern = /\u00c3|\u00e2\u20ac|\u0393|\u252c/;

function getSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(entryPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

describe("Lab 4 source regression guards", () => {
  it("recognizes each forbidden mojibake marker", () => {
    for (const marker of ["\u00c3", "\u00e2\u20ac", "\u0393", "\u252c"]) {
      expect(marker).toMatch(mojibakePattern);
    }
  });

  it("keeps all client source valid UTF-8 without a BOM or mojibake", () => {
    for (const filePath of getSourceFiles(sourceDirectory)) {
      const bytes = readFileSync(filePath);
      const hasUtf8Bom =
        bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
      expect(hasUtf8Bom, filePath).toBe(false);
      const contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      expect(contents, filePath).not.toMatch(mojibakePattern);
    }
  });

  it("keeps the Lab 4 API values and types exported", () => {
    expect(api.ACTION_RESULTS).toEqual([
      "RESOLVED_STEP",
      "WORKAROUND",
      "INFO_REQUESTED",
      "ESCALATED",
      "NO_FURTHER_ACTION",
    ]);
    expect(api.getStaffActions).toBeTypeOf("function");
    expect(api.getRequesterActions).toBeTypeOf("function");
    expect(api.createStaffAction).toBeTypeOf("function");
    expect(api.patchStaffAction).toBeTypeOf("function");
    expect(api.getRequesterDashboard).toBeTypeOf("function");
    expect(api.getStaffDashboard).toBeTypeOf("function");

    const actionResult: api.ActionResult = "RESOLVED_STEP";
    const patch: api.PatchActionInput = { expectedUpdatedAt: "2026-10-31T00:00:00.000Z" };
    const pendingCount: api.StaffTicketDetail["pendingFollowUpCount"] = 1;
    const errorData: api.ApiError["data"] = { currentUpdatedAt: "2026-10-31T00:00:00.000Z" };
    const apiError = new api.ApiError(409, "VERSION_CONFLICT", "Conflict", undefined, errorData);
    expect(apiError.data).toEqual(errorData);
    expect([actionResult, patch.expectedUpdatedAt, pendingCount, errorData]).toBeDefined();
  });
});
