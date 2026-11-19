// Unicode-aware so non-Latin names (e.g. Bangla) keep a usable slug instead
// of collapsing to an empty string.
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
