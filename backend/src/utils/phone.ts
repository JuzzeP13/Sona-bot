export function normalizeRussianPhone(input: string): string | null {
  const normalized = input.replace(/[\s()-]/g, "");

  if (!/^\+7\d{10}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
