import { HttpException, HttpStatus } from '@nestjs/common';

/** Erreur API avec code machine stable (traduit côté frontend). */
export function apiError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
