import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public, ReqMeta } from '../common/decorators';
import type { RequestMeta } from '../common/auth-user';
import type { Env } from '../config/env';
import { CandidateAuthService, PortalAuthResult } from './candidate-auth.service';
import { CurrentCandidate } from './current-candidate.decorator';
import { PortalActivateDto, PortalForgotPasswordDto, PortalLoginDto, PortalRefreshDto, PortalResetPasswordDto } from './dto/candidate-auth.dto';
import { CandidateJwtAuthGuard } from './guards/candidate-jwt-auth.guard';

const COOKIE = 'siw_portal_refresh';

/**
 * Toutes les routes sont @Public() pour être ignorées par le JwtAuthGuard employé (global) ; l'authentification
 * du portail est assurée séparément par CandidateJwtAuthGuard, appliqué explicitement où nécessaire ci-dessous.
 */
@Public()
@ApiTags('portal-auth')
@Controller('portal/auth')
export class CandidateAuthController {
  constructor(
    private readonly auth: CandidateAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: PortalLoginDto, @ReqMeta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.login(dto.email, dto.password, meta), req, res);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Body() dto: PortalRefreshDto, @ReqMeta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies?.[COOKIE] as string | undefined) ?? dto.refreshToken;
    return this.respond(await this.auth.refresh(raw, meta), req, res);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: PortalRefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req.cookies?.[COOKIE] as string | undefined) ?? dto.refreshToken);
    res.clearCookie(COOKIE, this.cookieOptions());
  }

  @ApiBearerAuth()
  @UseGuards(CandidateJwtAuthGuard)
  @Get('me')
  me(@CurrentCandidate() candidate: { id: string }) {
    return this.auth.me(candidate.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post('activate')
  async activate(@Body() dto: PortalActivateDto, @ReqMeta() meta: RequestMeta) {
    await this.auth.activate(dto.token, dto.newPassword, meta);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('forgot-password')
  async forgot(@Body() dto: PortalForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post('reset-password')
  async reset(@Body() dto: PortalResetPasswordDto, @ReqMeta() meta: RequestMeta) {
    await this.auth.resetPassword(dto.token, dto.newPassword, meta);
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax' as const,
      path: '/api/portal/auth',
    };
  }

  private respond(result: PortalAuthResult, req: Request, res: Response) {
    res.cookie(COOKIE, result.refreshToken, { ...this.cookieOptions(), expires: result.refreshExpiresAt });
    const mobile = req.headers['x-client-type'] === 'mobile';
    return { accessToken: result.accessToken, candidate: result.candidate, ...(mobile ? { refreshToken: result.refreshToken } : {}) };
  }
}
