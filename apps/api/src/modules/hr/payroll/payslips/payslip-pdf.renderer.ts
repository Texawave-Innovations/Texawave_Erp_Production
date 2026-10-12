import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Browser, chromium } from "playwright";

/**
 * HTML → PDF through headless Chromium. One browser is launched lazily on
 * first use and shared; each render gets its own context so pages never see
 * each other's state.
 *
 * The browser is either the one `pnpm --filter api exec playwright install
 * chromium` downloads (default), or — when `PDF_BROWSER_CHANNEL` is set — an
 * Edge/Chrome already installed on the host.
 *
 * Kept behind its own provider so e2e tests can replace it and run without
 * a browser.
 */
@Injectable()
export class PayslipPdfRenderer implements OnModuleDestroy {
  private browser: Promise<Browser> | null = null;
  private readonly channel: string | undefined;

  constructor(config: ConfigService) {
    this.channel = config.get<string>("PDF_BROWSER_CHANNEL");
  }

  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load" });
      return await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browser) return;
    const browser = await this.browser.catch(() => null);
    this.browser = null;
    await browser?.close();
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = chromium.launch({
        headless: true,
        ...(this.channel ? { channel: this.channel } : {}),
      });
      // A failed launch must not be cached — retry on the next request.
      this.browser.catch(() => {
        this.browser = null;
      });
    }
    return this.browser;
  }
}
