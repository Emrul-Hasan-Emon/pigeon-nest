// "%value%" for ILIKE with LIKE wildcards escaped, so '%' and '_' in the
// search text match the literal character.
export function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}
