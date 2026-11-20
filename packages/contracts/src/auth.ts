import { z } from 'zod';

export const LoginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Must be a valid email address').max(255),
    // Length policy applies when a password is set, not when an existing one is checked.
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const InviteAcceptSchema = z
  .object({
    token: z.string().min(16).max(128),
    password: z.string().min(10, 'Password must be at least 10 characters').max(128),
  })
  .strict();

export type InviteAccept = z.infer<typeof InviteAcceptSchema>;

/** An OAuth authorization code (Google or GitHub); the API redeems it itself. */
export const GoogleCodeSchema = z.object({ code: z.string().min(1).max(2048) }).strict();

export type GoogleCode = z.infer<typeof GoogleCodeSchema>;

export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10, 'Password must be at least 10 characters').max(128),
  })
  .strict();

export type PasswordChange = z.infer<typeof PasswordChangeSchema>;

export const PasswordForgotSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
  })
  .strict();

export type PasswordForgot = z.infer<typeof PasswordForgotSchema>;
