/** "Rahim Khan" becomes "Rahim K.": the public never sees a full name, phone or email. */
export function maskName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.`;
}
