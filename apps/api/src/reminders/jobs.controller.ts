import { Controller, Headers, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { RemindersService } from './reminders.service';

/**
 * Réveil extérieur de la tournée du matin (Vercel Cron, cron d'un serveur…), en plus du réveil intégré.
 * Protégé par JOBS_SECRET : sans secret configuré, la route n'existe pas (404).
 */
@Public()
@ApiExcludeController()
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('daily-reminders')
  async dailyReminders(@Headers('authorization') authorization: string | undefined) {
    const secret = this.config.get('JOBS_SECRET', { infer: true });
    if (!secret) throw new NotFoundException();
    const given = Buffer.from((authorization ?? '').replace(/^Bearer\s+/i, ''));
    const expected = Buffer.from(secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return this.reminders.runDue(new Date(), 'external');
  }
}
