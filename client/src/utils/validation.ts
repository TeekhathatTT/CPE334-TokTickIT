export const SUMMARY_MIN_LENGTH = 5;
export const SUMMARY_MAX_LENGTH = 120;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;

export function validateSummary(value: string): boolean {
  const length = value.trim().length;
  return length >= SUMMARY_MIN_LENGTH && length <= SUMMARY_MAX_LENGTH;
}

export function validateDescription(value: string): boolean {
  const length = value.trim().length;
  return length >= DESCRIPTION_MIN_LENGTH && length <= DESCRIPTION_MAX_LENGTH;
}

export function validatePriority(value: string): boolean {
  return ["LOW", "MEDIUM", "HIGH"].includes(value);
}