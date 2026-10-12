// CRM Core Domain — Success Celebration catalogue. One entry per meaningful CRM action. `variant`
// picks the render style (`modal` = big centered card with a confetti burst and a dismiss button,
// for major workflow moments; `toast` = small corner card, for everyday CRUD confirmations).
// `tone` picks the color language; `titles` rotates (avoiding immediate repeats) while `subtitle`/
// `description` stay fixed, factual descriptions of what just happened.
import {
  type LucideIcon,
  Building2,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  Crown,
  FileText,
  Handshake,
  Link2,
  Linkedin,
  Mail,
  MessageCircle,
  PartyPopper,
  PauseCircle,
  RotateCcw,
  Search,
  Send,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

export type CelebrationVariant = "modal" | "toast";
export type CelebrationTone =
  | "welcome"
  | "success"
  | "promoted"
  | "won"
  | "lost"
  | "hold"
  | "info"
  | "progress"
  | "teal"
  | "sky"
  | "pink"
  | "violet"
  | "indigo";

// Every modal-tier celebration gets the full party treatment (balloons, flying butterflies,
// bunting, firework bursts) EXCEPT the two tones that are deliberately calm on purpose: `lost`
// (Deal Lost) and `hold` (On Hold) must never look like a happy celebration, per the CRM brief —
// everything else that reaches the big centered card (account/lead/deal created, deal won,
// reopened, and every "completed" action — follow-up, task, meeting) is worth celebrating fully.
const NON_CELEBRATORY_TONES: CelebrationTone[] = ["lost", "hold"];
export function isPartyModalTone(tone: CelebrationTone): boolean {
  return !NON_CELEBRATORY_TONES.includes(tone);
}

export interface CelebrationDef {
  variant: CelebrationVariant;
  tone: CelebrationTone;
  icon: LucideIcon;
  /** Headline pool — rotates, never repeats the same phrase twice in a row. */
  titles: string[];
  /** Bold supporting line, always shown. */
  subtitle: string;
  /** Optional gray third line (modal) / second line (toast). Overridden by a call's `detail`. */
  description?: string;
  /** CTA label — modal variant only. */
  button?: string;
  durationMs: number;
}

export const CRM_CELEBRATIONS = {
  "system.welcome": {
    variant: "modal",
    tone: "welcome",
    icon: PartyPopper,
    titles: [
      "Welcome, Chief! 👋",
      "Good to See You, Chief! 🚀",
      "Welcome Back, Chief! 🔥",
      "Ready to Close Deals, Chief? 💼",
      "Let's Win Today, Chief! 🏆",
    ],
    subtitle: "You've got this — let's crush today's targets! 💪",
    button: "Let's Go! 🚀",
    durationMs: 2800,
  },

  "account.created": {
    variant: "modal",
    tone: "teal",
    icon: Building2,
    titles: ["Account Created Successfully!", "New Account Added! 🎉"],
    subtitle: "New account has been added to your CRM.",
    button: "Great! 🎉",
    durationMs: 2200,
  },
  "account.updated": {
    variant: "toast",
    tone: "teal",
    icon: Building2,
    titles: ["Account Updated!", "Looking Good! ✨"],
    subtitle: "Account details have been updated successfully.",
    durationMs: 1400,
  },
  "account.statusChanged": {
    variant: "toast",
    tone: "sky",
    icon: Target,
    titles: ["Status Updated!"],
    subtitle: "Account status has been changed successfully.",
    durationMs: 1400,
  },
  "account.notInterested": {
    variant: "toast",
    tone: "lost",
    icon: XCircle,
    titles: ["Not a Fit Right Now"],
    subtitle: "Keep moving forward to the next opportunity.",
    durationMs: 1400,
  },

  "mining.recordCreated": {
    variant: "toast",
    tone: "sky",
    icon: Search,
    titles: ["New Prospect Found! 🔎"],
    subtitle: "New mining record has been added.",
    durationMs: 1400,
  },
  "mining.promoted": {
    variant: "modal",
    tone: "promoted",
    icon: Crown,
    titles: ["Prospect Promoted! 🚀", "Promoted to Lead! 🎉"],
    subtitle: "This record has been promoted to a Lead.",
    button: "Awesome! 🚀",
    durationMs: 2600,
  },

  "lead.created": {
    variant: "modal",
    tone: "success",
    icon: Users,
    titles: ["Lead Created Successfully!", "New Lead Added! 🎉"],
    subtitle: "New lead has been added to your CRM.",
    button: "Great! 🎉",
    durationMs: 2200,
  },
  "lead.promoted": {
    variant: "modal",
    tone: "promoted",
    icon: Crown,
    titles: ["Congratulations!", "Lead Promoted! 🚀"],
    subtitle: "Lead promoted to Account successfully!",
    description: "New account has been created and linked.",
    button: "Awesome! 🚀",
    durationMs: 2800,
  },

  "deal.created": {
    variant: "modal",
    tone: "indigo",
    icon: Briefcase,
    titles: ["New Deal in Motion! 🚀", "Deal Created!"],
    subtitle: "New deal has been added to your pipeline.",
    button: "Great! 🎉",
    durationMs: 2200,
  },
  "deal.stageChanged": {
    variant: "toast",
    tone: "sky",
    icon: TrendingUp,
    titles: ["Moving Forward!", "Stage Updated! 📈"],
    subtitle: "Deal stage has been updated successfully.",
    durationMs: 1400,
  },
  "deal.interested": {
    variant: "toast",
    tone: "pink",
    icon: TrendingUp,
    titles: ["They're Interested! 🔥"],
    subtitle: "Deal moved to Interested.",
    durationMs: 1400,
  },
  "deal.proposalSent": {
    variant: "toast",
    tone: "violet",
    icon: Send,
    titles: ["Proposal Sent! 📄", "Proposal Is Out! 🎊"],
    subtitle: "Your proposal has been sent successfully.",
    durationMs: 1500,
  },
  "deal.negotiation": {
    variant: "toast",
    tone: "indigo",
    icon: Handshake,
    titles: ["Deal Is Heating Up! 🤝"],
    subtitle: "Negotiation is now in progress.",
    durationMs: 1400,
  },
  "deal.won": {
    variant: "modal",
    tone: "won",
    icon: Trophy,
    titles: [
      "Deal Won! 🏆",
      "Another Win for the Team! 🎉",
      "Excellent Work! 🚀",
    ],
    subtitle: "Congratulations! This deal has been won.",
    description: "added to your revenue.",
    button: "Celebrate! 🎉",
    durationMs: 3000,
  },
  "deal.lost": {
    variant: "modal",
    tone: "lost",
    icon: XCircle,
    titles: ["Deal Marked as Lost"],
    subtitle: "This deal has been moved to Lost.",
    description: "You can reopen it anytime.",
    button: "Okay 👍",
    durationMs: 2200,
  },
  "deal.onHold": {
    variant: "modal",
    tone: "hold",
    icon: PauseCircle,
    titles: ["Deal On Hold"],
    subtitle: "This deal has been moved to On Hold.",
    description: "You can resume it when ready.",
    button: "Got it 👍",
    durationMs: 2200,
  },
  "deal.reopened": {
    variant: "modal",
    tone: "teal",
    icon: RotateCcw,
    titles: ["Back in Action! 🚀"],
    subtitle: "This deal has been reopened.",
    button: "Let's Go! 🚀",
    durationMs: 2200,
  },

  "contact.created": {
    variant: "toast",
    tone: "success",
    icon: UserPlus,
    titles: ["Contact Created!", "New Connection! 🤝"],
    subtitle: "New contact has been added successfully.",
    durationMs: 1400,
  },
  "contact.updated": {
    variant: "toast",
    tone: "pink",
    icon: UserPlus,
    titles: ["Contact Updated!"],
    subtitle: "Contact details have been updated successfully.",
    durationMs: 1400,
  },
  "contact.linked": {
    variant: "toast",
    tone: "violet",
    icon: Link2,
    titles: ["Connection Added! 🔗"],
    subtitle: "Contact has been linked to the account.",
    durationMs: 1400,
  },

  "quote.created": {
    variant: "toast",
    tone: "info",
    icon: FileText,
    titles: ["Quote Created!", "Quote Ready! 📄"],
    subtitle: "New quote has been created successfully.",
    durationMs: 1400,
  },
  "quote.sent": {
    variant: "toast",
    tone: "violet",
    icon: Send,
    titles: ["Quote Sent! 🚀"],
    subtitle: "Your quote has been sent successfully.",
    durationMs: 1400,
  },
  "quote.statusChanged": {
    variant: "toast",
    tone: "info",
    icon: FileText,
    titles: ["Quote Status Updated!"],
    subtitle: "Quote status has been changed successfully.",
    durationMs: 1400,
  },

  "quota.created": {
    variant: "toast",
    tone: "progress",
    icon: Target,
    titles: ["Target Set! 🎯"],
    subtitle: "Quota has been created successfully.",
    durationMs: 1400,
  },
  "quota.updated": {
    variant: "toast",
    tone: "progress",
    icon: Target,
    titles: ["Quota Updated!", "Target Updated! 🎯"],
    subtitle: "Quota has been updated successfully.",
    durationMs: 1400,
  },

  "followup.completed": {
    variant: "modal",
    tone: "success",
    icon: CheckCircle2,
    titles: ["Follow-up Completed!", "Nice Follow-through! 🎯"],
    subtitle: "Great job! Your follow-up has been marked as completed.",
    button: "Well Done! 🎉",
    durationMs: 2200,
  },
  "task.completed": {
    variant: "modal",
    tone: "teal",
    icon: CheckCircle2,
    titles: ["Task Completed!", "Task Crushed! 💪"],
    subtitle: "Great job! Your task has been marked as completed.",
    button: "Well Done! 🎉",
    durationMs: 2200,
  },
  "meeting.completed": {
    variant: "modal",
    tone: "sky",
    icon: CalendarCheck2,
    titles: ["Meeting Completed!"],
    subtitle: "Great job! Your meeting has been marked as completed.",
    button: "Well Done! 🎉",
    durationMs: 2200,
  },
  "sendInfo.completed": {
    variant: "toast",
    tone: "info",
    icon: Send,
    titles: ["Information Sent! 📤"],
    subtitle: "Details have been sent successfully.",
    durationMs: 1400,
  },

  "whatsapp.logged": {
    variant: "toast",
    tone: "success",
    icon: MessageCircle,
    titles: ["WhatsApp Logged!", "Conversation Logged! 💬"],
    subtitle: "WhatsApp interaction has been logged successfully.",
    durationMs: 1400,
  },
  "linkedin.logged": {
    variant: "toast",
    tone: "indigo",
    icon: Linkedin,
    titles: ["Connection Made! 🔗", "Great Outreach! 💼"],
    subtitle: "LinkedIn touchpoint has been logged successfully.",
    durationMs: 1400,
  },
  "email.logged": {
    variant: "toast",
    tone: "info",
    icon: Mail,
    titles: ["Email Sent!", "Communication Logged! ✉️"],
    subtitle: "Your email has been sent successfully.",
    durationMs: 1400,
  },
} as const satisfies Record<string, CelebrationDef>;

export type CrmCelebrationKey = keyof typeof CRM_CELEBRATIONS;
