import { Controller, Post, Get, Body, Param, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.ts';
import { ConfigService } from '../../platform/config/config.service.ts';
import { Public } from './decorators.ts';
import { sessionToken } from './auth.guard.ts';
import { CurrentUser, type RequestUser } from './decorators.ts';
import {
  LoginRequestSchema,
  InviteAcceptSchema,
  PasswordChangeSchema,
  PasswordForgotSchema,
  GoogleCodeSchema,
  type LoginRequest,
  type InviteAccept,
  type PasswordChange,
  type PasswordForgot,
  type GoogleCode,
} from '@fecpc/contracts';
import { ZodValidationPipe } from '../../platform/http/zod-validation.pipe.ts';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** The session cookie. The server decides when a session ends; the cookie only has to outlive it. */
  private setSession(reply: FastifyReply, token: string) {
    reply.setCookie(this.config.sessionCookieName, token, {
      path: '/',
      httpOnly: true,
      secure: this.config.env.APP_ENV !== 'local',
      sameSite: 'lax',
      maxAge: this.config.env.SESSION_ABSOLUTE_DAYS * 24 * 60 * 60,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(body.email, body.password, req.ip);
    this.setSession(reply, result.token);
    return { user: result.user };
  }

  /** 200 for a live, unsuspended session (the global AuthGuard checks it). Web routes that do their own work use it. */
  @Get('session')
  session() {
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = sessionToken(req, this.config.sessionCookieName);
    if (token) await this.authService.logout(token);
    reply.clearCookie(this.config.sessionCookieName, { path: '/' });
    return { ok: true };
  }

  @Public()
  @Get('invite/:token')
  async getInvite(@Param('token') token: string) {
    return this.authService.getInvite(token);
  }

  @Public()
  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body(new ZodValidationPipe(InviteAcceptSchema)) body: InviteAccept,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.acceptInvite(body.token, body.password, req.ip);
    this.setSession(reply, result.token);
    return { user: result.user };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(PasswordChangeSchema)) body: PasswordChange,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
      req.ip,
    );
    this.setSession(reply, token);
    return { ok: true };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body(new ZodValidationPipe(PasswordForgotSchema)) _body: PasswordForgot) {
    // Always 202, so the answer never reveals whether an account exists.
    return { ok: true };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body(new ZodValidationPipe(GoogleCodeSchema)) body: GoogleCode,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.loginWithGoogle(body.code);
    this.setSession(reply, result.token);
    return { user: result.user };
  }

  @Public()
  @Post('github')
  @HttpCode(HttpStatus.OK)
  async githubAuth(
    @Body(new ZodValidationPipe(GoogleCodeSchema)) body: GoogleCode,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.loginWithGithub(body.code);
    this.setSession(reply, result.token);
    return { user: result.user };
  }
}
