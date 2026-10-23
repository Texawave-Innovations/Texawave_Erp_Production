// Static copy for the SCM AI Copilot. Kept separate from the components/service so the
// bot's identity and suggestion list can change without touching any rendering or data logic.

export const SCM_AI_BOT_NAME = "Texa SCM Copilot";
export const SCM_AI_TAGLINE = "Your AI assistant for Supply Chain Management";
/** Short form used in the header row itself, where "Clear Chat" now also needs room. */
export const SCM_AI_HEADER_SUBTITLE = "SCM Assistant";

export const SCM_AI_WELCOME_MESSAGE =
  "Hi! I'm Texa SCM Copilot. I can help you understand suppliers, procurement, inventory, " +
  "warehouse operations, fulfillment, logistics, returns, quality, and SCM reports.";

/** Shown as suggestion chips — always available (not just on an empty conversation), so the
 * user never has to remember or retype a working phrase (spec: persistent suggestions). */
export const SCM_AI_SUGGESTED_PROMPTS: string[] = [
  "Show SCM summary",
  "Which suppliers do we have?",
  "Show pending purchase orders",
  "Which products are low in stock?",
  "Show inventory status",
  "Show warehouse status",
  "Show pending/backordered orders",
  "Show shipment status",
  "Show returns",
  "Show quality issues",
  "Show supplier performance",
  "Open Control Tower",
];
