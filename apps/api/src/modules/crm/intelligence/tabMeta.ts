// Display metadata (label / source route / icon / Firebase path) for the 9 company-level CRM
// source tabs. Single source of truth reused across the new Dashboard, Search, Calendar,
// Company 360, and Analytics pages — never used to alter the existing tabs themselves.
import {
  Database,
  Phone,
  Users,
  Clock,
  PhoneCall,
  UserX,
  MessageCircle,
  MessageSquare,
  Linkedin,
  type LucideIcon,
} from "lucide-react";
import { CrmSourceTabKey } from "./types";

export interface TabMeta {
  label: string;
  route: string;
  icon: LucideIcon;
  firebasePath: string;
}

export const TAB_META: Record<CrmSourceTabKey, TabMeta> = {
  accountsMiningSheet: {
    label: "Accounts Mining Sheet",
    route: "/crm/accounts-mining-sheet",
    icon: Database,
    firebasePath: "crm/accountsMiningSheet",
  },
  coldCalling: {
    label: "Cold Calling Status",
    route: "/crm/cold-calling-status",
    icon: Phone,
    firebasePath: "crm/coldCallingStatus",
  },
  leads: {
    label: "Leads",
    route: "/crm/leads",
    icon: Users,
    firebasePath: "crm/leads",
  },
  yetToHappen: {
    label: "Yet to Happen",
    route: "/crm/yet-to-happen",
    icon: Clock,
    firebasePath: "crm/yetToHappen",
  },
  callBackSendInfo: {
    label: "Call Back-Send Info",
    route: "/crm/call-back-send-info",
    icon: PhoneCall,
    firebasePath: "crm/callBackSendInfo",
  },
  notInterested: {
    label: "Not Interested",
    route: "/crm/not-interested",
    icon: UserX,
    firebasePath: "crm/notInterested",
  },
  keepInTouch: {
    label: "Keep in Touch",
    route: "/crm/keep-in-touch",
    icon: MessageCircle,
    firebasePath: "crm/keepInTouch",
  },
  whatsapp: {
    label: "WhatsApp",
    route: "/crm/whatsapp",
    icon: MessageSquare,
    firebasePath: "crm/whatsapp",
  },
  linkedin: {
    label: "LinkedIn",
    route: "/crm/linkedin",
    icon: Linkedin,
    firebasePath: "crm/linkedin",
  },
};

export const ALL_SOURCE_TABS: CrmSourceTabKey[] = [
  "accountsMiningSheet",
  "coldCalling",
  "leads",
  "yetToHappen",
  "callBackSendInfo",
  "notInterested",
  "keepInTouch",
  "whatsapp",
  "linkedin",
];
