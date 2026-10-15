import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface OutgoingMail {
  to: string[];
  cc?: string[] | undefined;
  subject: string;
  text: string;
  attachments?:
    | Array<{ filename: string; content: Buffer; contentType: string }>
    | undefined;
}

/** SENT, or NOT_CONFIGURED when there is no SMTP account (dev/test). */
export type MailOutcome = "SENT" | "NOT_CONFIGURED";

/**
 * Sends via Gmail SMTP when GMAIL_USER/GMAIL_APP_PASSWORD are set; otherwise
 * falls back to logging the link (keeps local dev/e2e working without real
 * credentials — see env.validation.ts). GMAIL_APP_PASSWORD is a 16-char App
 * Password, not the account's real login password. No template design —
 * plain text only, per the forgot-password user story ("email template
 * design polish" is explicitly excluded). Moved from platform/auth/ to
 * shared/ when Sales became its second consumer (Docs/CODING_STANDARDS.md
 * §3): auth sends reset links, Sales sends documents through `send()`.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;
  private readonly isProduction: boolean;

  constructor(private readonly config: ConfigService) {
    this.isProduction = this.config.get<string>("NODE_ENV") === "production";
    const user = this.config.get<string>("GMAIL_USER");
    const pass = this.config.get<string>("GMAIL_APP_PASSWORD");
    // Vitest always sets NODE_ENV=test, so e2e runs never send real mail even
    // when GMAIL_* is configured for local dev. Production never sets "test".
    const stubbed = this.config.get<string>("NODE_ENV") === "test";

    this.from = user ?? null;
    this.transporter =
      !stubbed && user && pass
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user, pass },
          })
        : null;
  }

  /**
   * Sends one plain-text email, optionally with attachments. Returns
   * `NOT_CONFIGURED` (nothing sent, nothing thrown) when SMTP is not set up
   * or under tests, so callers can tell the user; an SMTP failure throws.
   */
  async send(message: OutgoingMail): Promise<MailOutcome> {
    if (!this.transporter || !this.from) {
      this.logger.warn(
        `Email "${message.subject}" to ${message.to.join(", ")} not sent: SMTP is not configured`,
      );
      return "NOT_CONFIGURED";
    }
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      ...(message.cc?.length ? { cc: message.cc } : {}),
      subject: message.subject,
      text: message.text,
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            })),
          }
        : {}),
    });
    return "SENT";
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.transporter || !this.from) {
      // The link carries a raw reset token — anyone who can read production
      // logs could use it to take over the account. Only dev/test get it.
      if (this.isProduction) {
        this.logger.error(
          `Password reset email for ${to} not sent: GMAIL_USER/GMAIL_APP_PASSWORD are not configured`,
        );
        return;
      }
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
