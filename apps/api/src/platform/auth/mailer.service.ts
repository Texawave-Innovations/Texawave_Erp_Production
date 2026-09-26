import { Injectable, Logger } from "@nestjs/common";

/**
 * Dev stub — no real SMTP/provider integration yet (out of scope per the
 * forgot-password user story; "email template design polish" is explicitly
 * excluded). Logs the link instead of sending it. Lives inside
 * platform/auth/ rather than shared/ because auth is currently its only
 * consumer (Docs/CODING_STANDARDS.md §3) — move it to shared/mailer/ if/when
 * a second module needs to send email.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.log(`Password reset link for ${to}: ${resetUrl}`);
  }
}
