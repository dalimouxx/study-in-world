import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, Public, ReqMeta } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import type { Env } from '../config/env';
import { AuthResult, AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RefreshDto, ResetPasswordDto, TwoFactorCodeDto, TwoFactorDisableDto, TwoFactorVerifyDto } from './dto/auth.dto';
import { AllowDuringTwoFactorSetup } from './two-factor/two-factor.guard';
import { TwoFactorService } from './two-factor/two-factor.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

const COOKIE = 'siw_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @ReqMeta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, meta);
    // Double authentification : pas encore de session ni de cookie, seulement le jeton d'étape.
    if ('twoFactorRequired' in result) return result;
    return this.respond(result, req, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('2fa/verify')
  async verifyTwoFactor(@Body() dto: TwoFactorVerifyDto, @ReqMeta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.verifyTwoFactor(dto.twoFactorToken, dto.code, meta), req, res);
  }

  @ApiBearerAuth()
  @AllowDuringTwoFactorSetup()
  @HttpCode(200)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.twoFactor.setup(user);
  }

  @ApiBearerAuth()
  @AllowDuringTwoFactorSetup()
  @HttpCode(200)
  @Post('2fa/enable')
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto, @ReqMeta() meta: RequestMeta) {
    return this.twoFactor.enable(user, dto.code, meta);
  }

  @ApiBearerAuth()
  @HttpCode(204)
  @Post('2fa/disable')
  async disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto, @ReqMeta() meta: RequestMeta) {
    await this.twoFactor.disable(user, dto.password, dto.code, meta);
  }

  /** Téléphone perdu : le Super Admin réinitialise la double authentification d'un employé. */
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @HttpCode(204)
  @Post('2fa/reset/:userId')
  async resetTwoFactor(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @ReqMeta() meta: RequestMeta) {
    await this.twoFactor.reset(user, userId, meta);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @ReqMeta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies?.[COOKIE] as string | undefined) ?? dto.refreshToken;
    return this.respond(await this.auth.refresh(raw, meta), req, res);
  }

  @Public()
  @AllowDuringTwoFactorSetup()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req.cookies?.[COOKIE] as string | undefined) ?? dto.refreshToken);
    res.clearCookie(COOKIE, this.cookieOptions());
  }

  @ApiBearerAuth()
  @AllowDuringTwoFactorSetup()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @AllowDuringTwoFactorSetup()
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @ReqMeta() meta: RequestMeta,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.changePassword(user, dto.currentPassword, dto.newPassword, meta), req, res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto, @ReqMeta() meta: RequestMeta) {
    await this.auth.resetPassword(dto.token, dto.newPassword, meta);
  }

  private cookieOptions() {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    // En production, le frontend (Vercel) et l'API (Render) sont sur des domaines différents : un cookie
    // "lax" n'est alors jamais renvoyé par le navigateur sur les requêtes fetch/XHR cross-site (seulement
    // sur une navigation top-level), ce qui casse le rafraîchissement silencieux du token. "none" (qui exige
    // "secure") est nécessaire dès que front et API ne partagent pas le même site.
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/api/auth',
    };
  }

  /** Cookie httpOnly pour le web ; le token n'est renvoyé dans le corps que pour les clients mobiles. */
  private respond(result: AuthResult, req: Request, res: Response) {
    res.cookie(COOKIE, result.refreshToken, { ...this.cookieOptions(), expires: result.refreshExpiresAt });
    const mobile = req.headers['x-client-type'] === 'mobile';
    return {
      accessToken: result.accessToken,
      user: result.user,
      ...(mobile ? { refreshToken: result.refreshToken } : {}),
    };
  }
}
