import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { CreateLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('public')
@Controller('public/leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post()
  async create(@Body() dto: CreateLeadDto) {
    await this.leads.create(this.config.get('DEFAULT_ORG_SLUG', { infer: true }), dto);
  }
}
