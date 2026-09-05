import { describe, expect, it } from "vitest";
import {
  validateDescription,
  validatePriority,
  validateSummary,
} from "../src/utils/validation";

describe("ticket validation", () => {
  it.each([
    ["a".repeat(4), false],
    ["a".repeat(5), true],
    ["a".repeat(120), true],
    ["a".repeat(121), false],
  ])("validates summary length", (value, expected) => {
    expect(validateSummary(value)).toBe(expected);
  });

  it.each([
    ["a".repeat(9), false],
    ["a".repeat(10), true],
    ["a".repeat(2000), true],
    ["a".repeat(2001), false],
  ])("validates description length", (value, expected) => {
    expect(validateDescription(value)).toBe(expected);
  });

  it.each([["LOW"], ["MEDIUM"], ["HIGH"]])("accepts priority %s", (priority) => {
    expect(validatePriority(priority)).toBe(true);
  });

  it("rejects an unknown priority", () => {
    expect(validatePriority("URGENT")).toBe(false);
  });
});