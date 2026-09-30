import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sends via Gmail SMTP when GMAIL_USER/GMAIL_APP_PASSWORD are set; otherwise
 * falls back to logging the link (keeps local dev/e2e working without real
 * credentials — see env.validation.ts). GMAIL_APP_PASSWORD is a 16-char App
 * Password, not the account's real login password. No template design —
 * plain text only, per the forgot-password user story ("email template
 * design polish" is explicitly excluded). Lives inside platform/auth/ rather
 * than shared/ because auth is currently its only consumer
 * (Docs/CODING_STANDARDS.md §3) — move it to shared/mailer/ if/when a second
 * module needs to send email.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>("GMAIL_USER");
    const pass = this.config.get<string>("GMAIL_APP_PASSWORD");

    this.from = user ?? null;
    this.transporter =
      user && pass
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user, pass },
          })
        : null;
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.transporter || !this.from) {
      this.logger.log(`Password reset link for ${to}: ${resetUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: "Reset your password",
        text: `Use this link to reset your password: ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      });
    } catch (error) {
      // Never let a mailer failure leak into the forgot-password response
      // (still returns the same generic 200) — log server-side only.
      this.logger.error(`Failed to send password reset email to ${to}`, error);
    }
  }
}
