import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { createTransport, sendMail };
});

// Never open a real SMTP connection.
vi.mock("nodemailer", () => ({
  default: { createTransport },
  createTransport,
}));

import { MailerService } from "./mailer.service.js";

function makeMailer(values: Record<string, string | undefined>) {
  const config = { get: vi.fn((key: string) => values[key]) };
  return new MailerService(config as never);
}

const CONFIGURED = {
  GMAIL_USER: "noreply@acme.test",
  GMAIL_APP_PASSWORD: "abcdabcdabcdabcd",
  NODE_ENV: "production",
};

describe("MailerService", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createTransport.mockClear();
    sendMail.mockReset();
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    error = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Gmail transport with the configured credentials", () => {
    makeMailer(CONFIGURED);
    expect(createTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "noreply@acme.test", pass: "abcdabcdabcdabcd" },
    });
  });

  it("sends a plain-text reset email from the configured account", async () => {
    sendMail.mockResolvedValue({ messageId: "1" });
    const mailer = makeMailer(CONFIGURED);

    await mailer.sendPasswordResetEmail(
      "jane@acme.test",
      "https://erp.test/reset-password?token=abc",
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: "noreply@acme.test",
      to: "jane@acme.test",
      subject: "Reset your password",
      text: expect.stringContaining(
        "https://erp.test/reset-password?token=abc",
      ) as unknown as string,
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("swallows SMTP failures so the forgot-password response stays generic", async () => {
    const failure = new Error("SMTP down");
    sendMail.mockRejectedValue(failure);
    const mailer = makeMailer(CONFIGURED);

    await expect(
      mailer.sendPasswordResetEmail("jane@acme.test", "https://x/reset"),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "Failed to send password reset email to jane@acme.test",
      failure,
    );
  });

  it("never creates a transport under NODE_ENV=test, even with credentials", async () => {
    const mailer = makeMailer({ ...CONFIGURED, NODE_ENV: "test" });

    await mailer.sendPasswordResetEmail("jane@acme.test", "https://x/reset");

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Password reset link for jane@acme.test: https://x/reset",
    );
  });

  it("falls back to logging when the app password is missing", async () => {
    const mailer = makeMailer({ ...CONFIGURED, GMAIL_APP_PASSWORD: undefined });

    await mailer.sendPasswordResetEmail("jane@acme.test", "https://x/reset");

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("falls back to logging when the Gmail user is missing", async () => {
    const mailer = makeMailer({ ...CONFIGURED, GMAIL_USER: undefined });

    await mailer.sendPasswordResetEmail("jane@acme.test", "https://x/reset");

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
