import { randomInt } from 'crypto';

// No 0/O/1/I: an order number gets read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "PN260520-K7M2QX": the day it was placed plus 6 random characters. */
export function newOrderNumber(now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  let tail = '';
  for (let i = 0; i < 6; i++) tail += ALPHABET[randomInt(ALPHABET.length)];
  return `PN${yy}${mm}${dd}-${tail}`;
}
