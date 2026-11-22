import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/** The bearer token of a request. Exactly "Bearer <token>", nothing else is accepted. */
export function bearerToken(request: Request): string {
  const parts = (request.headers.authorization ?? '').split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) throw new UnauthorizedException('Token not found');
  return parts[1];
}
