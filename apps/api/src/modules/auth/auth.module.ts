import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.ts';
import { AuthGuard } from './auth.guard.ts';
import { AuthService } from './auth.service.ts';
import { LoginThrottlingService } from './login-throttling.service.ts';

@Module({
  controllers: [AuthController],
  // AuthGuard runs on every route; @Public() opts a route out.
  providers: [AuthService, LoginThrottlingService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
