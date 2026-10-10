import {
  Briefcase,
  CheckCircle,
  Laptop,
  Palette,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";
import type { TeamItem } from "./types";

export const INITIAL_TEAMS: TeamItem[] = [
  {
    id: 1,
    name: "Software Team",
    code: "TEAM-SW",
    description: "Web platform, cloud services, and embedded software systems.",
    icon: "laptop",
    lead: "Super Admin",
    isActive: true,
  },
  {
    id: 2,
    name: "Mechanical Team",
    code: "TEAM-ME",
    description: "CAD modeling, structural design, and physical prototyping.",
    icon: "wrench",
    lead: "Pending Assignment",
    isActive: true,
  },
  {
    id: 3,
    name: "Electrical Team",
    code: "TEAM-EE",
    description:
      "Circuit board schematic design, power distribution, and firmware integration.",
    icon: "zap",
    lead: "Pending Assignment",
    isActive: true,
  },
];

export const TEAMS_STORAGE_KEY = "texawave_teams_data";

export function getStoredTeams(): TeamItem[] {
  if (typeof window === "undefined") {
    return INITIAL_TEAMS;
  }
  try {
    const raw = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (!raw) return INITIAL_TEAMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore storage parse errors and fallback
  }
  return INITIAL_TEAMS;
}

export function saveStoredTeams(teams: TeamItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Returns a domain icon based on team name keywords.
 */
export function getTeamIcon(name: string): ElementType {
  const lower = name.toLowerCase();
  if (
    lower.includes("soft") ||
    lower.includes("tech") ||
    lower.includes("dev") ||
    lower.includes("web") ||
    lower.includes("cloud")
  ) {
    return Laptop;
  }
  if (
    lower.includes("mech") ||
    lower.includes("cad") ||
    lower.includes("prototype")
  ) {
    return Wrench;
  }
  if (
    lower.includes("elect") ||
    lower.includes("circuit") ||
    lower.includes("power") ||
    lower.includes("firmware")
  ) {
    return Zap;
  }
  if (
    lower.includes("sale") ||
    lower.includes("market") ||
    lower.includes("growth")
  ) {
    return TrendingUp;
  }
  if (
    lower.includes("design") ||
    lower.includes("ui") ||
    lower.includes("ux") ||
    lower.includes("creative")
  ) {
    return Palette;
  }
  if (
    lower.includes("qa") ||
    lower.includes("test") ||
    lower.includes("quality")
  ) {
    return CheckCircle;
  }
  if (lower.includes("operation") || lower.includes("biz")) {
    return Briefcase;
  }
  return Users;
}

/**
 * Generates an automatic readable team code in uppercase, e.g. "TEAM-SW", "TEAM-QA".
 */
export function generateTeamCode(name: string): string {
  if (!name.trim()) return "TEAM-GEN";
  const clean = name.trim().replace(/team/i, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
    return `TEAM-${initials}`;
  }
  const single = clean || name.trim();
  if (single.length >= 2) {
    return `TEAM-${single.slice(0, 2).toUpperCase()}`;
  }
  return `TEAM-${single.toUpperCase()}`;
}
