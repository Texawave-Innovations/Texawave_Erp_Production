export interface TeamItem {
  id: number;
  name: string;
  code: string;
  description: string;
  icon?: string;
  lead: string;
  isActive: boolean;
  memberCount?: number;
}

export type TeamStatusFilter = "all" | "active" | "inactive";

export interface TeamFormData {
  name: string;
  code?: string | undefined;
  description: string;
  isActive: boolean;
}
