// HANDWRITTEN — mirrors apps/api/src/modules/scm/quality. Migrated from the
// LEGACY TexaWave_ERP_old/src/modules/scm/quality. Decimal columns arrive as
// strings. See packages/api-types/README.md.

export const INSPECTION_TYPES = [
  "INCOMING",
  "CUSTOMER_RETURN",
  "INVENTORY",
  "PRE_DISPATCH",
] as const;
export type QualityInspectionType = (typeof INSPECTION_TYPES)[number];
export const INSPECTION_TYPE_LABEL: Record<QualityInspectionType, string> = {
  INCOMING: "Incoming (GRN)",
  CUSTOMER_RETURN: "Customer Return",
  INVENTORY: "Inventory",
  PRE_DISPATCH: "Pre-Dispatch",
};

export const QUALITY_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "USED",
  "DAMAGED",
  "DEFECTIVE",
  "MISSING_PARTS",
  "CONTAMINATED",
  "UNKNOWN",
] as const;
export const DEFECT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];
export const CHECKPOINT_RESULTS = ["PASS", "FAIL", "NA"] as const;
export const INSPECTION_STATUSES = [
  "DRAFT",
  "PENDING_INSPECTION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type QualityInspectionStatus = (typeof INSPECTION_STATUSES)[number];
export const QUALITY_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
export const QUARANTINE_STATUSES = [
  "QUARANTINED",
  "UNDER_REVIEW",
  "RELEASED",
  "REJECTED",
] as const;
export const QUALITY_DISPOSITIONS = [
  "ACCEPT",
  "RELEASE",
  "QUARANTINE",
  "REWORK",
  "DAMAGED",
  "SCRAP",
  "REJECT",
] as const;
export type QualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];
export type QualityItemResult = "PASS" | "PARTIAL_PASS" | "FAIL" | "HOLD";
export type QualityOverallResult =
  "PASSED" | "PARTIALLY_PASSED" | "FAILED" | "ON_HOLD";

export interface QualityDefect {
  id: number;
  defectCode: string;
  name: string;
  description: string | null;
  category: string;
  severity: DefectSeverity;
  active: boolean;
  createdAt: string;
}
export interface CreateDefectInput {
  defectCode: string;
  name: string;
  description?: string | undefined;
  category: string;
  severity: DefectSeverity;
}
export interface UpdateDefectInput {
  name?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  severity?: DefectSeverity | undefined;
  active?: boolean | undefined;
}

export interface QualityCheckpoint {
  checkpointId?: string | undefined;
  name: string;
  description?: string | undefined;
  required: boolean;
  expectedValue?: string | undefined;
  unit?: string | undefined;
}
export interface StoredCheckpoint {
  checkpointId: string;
  name: string;
  description: string | null;
  required: boolean;
  expectedValue: string | null;
  unit: string | null;
  sequence: number;
}
export interface QualityTemplate {
  id: number;
  templateCode: string;
  name: string;
  description: string | null;
  inspectionType: QualityInspectionType;
  active: boolean;
  checkpoints: StoredCheckpoint[];
  createdAt: string;
}
export interface CreateTemplateInput {
  templateCode: string;
  name: string;
  description?: string | undefined;
  inspectionType: QualityInspectionType;
  checkpoints: QualityCheckpoint[];
}
export interface UpdateTemplateInput {
  name?: string | undefined;
  description?: string | undefined;
  active?: boolean | undefined;
  checkpoints?: QualityCheckpoint[] | undefined;
}

export interface CheckpointResult {
  checkpointId: string;
  result: (typeof CHECKPOINT_RESULTS)[number];
  observedValue?: string | undefined;
  notes?: string | undefined;
  defectCode?: string | undefined;
}
export interface StoredCheckpointResult extends CheckpointResult {
  name: string;
  required: boolean;
}

export interface QualityInspectionItem {
  id: number;
  lineNo: number;
  productId: number;
  productCode: string;
  productName: string;
  sourceLineId: number | null;
  batchId: number | null;
  batchNumber: string | null;
  serialNumbers: string[];
  orderedQty: string | null;
  sourceQty: string;
  inspectedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  inspectionResult: QualityItemResult | null;
  condition: string | null;
  defectCode: string | null;
  defectDescription: string | null;
  disposition: QualityDisposition | null;
  notes: string | null;
  warehouseId: number | null;
  locationId: number | null;
  unitCost: string | null;
  checkpointResults: StoredCheckpointResult[];
  ledgerEntryId: number | null;
  quarantineRecordId: number | null;
}

export interface QualityInspection {
  id: number;
  inspectionNumber: string;
  inspectionType: QualityInspectionType;
  sourceType: string;
  sourceId: number;
  sourceNumber: string | null;
  templateId: number | null;
  templateName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  customerId: number | null;
  customerName: string | null;
  warehouseId: number | null;
  locationId: number | null;
  status: QualityInspectionStatus;
  result: QualityOverallResult | null;
  priority: (typeof QUALITY_PRIORITIES)[number];
  inspectionDate: string;
  startedAt: string | null;
  completedAt: string | null;
  inspectorId: number | null;
  inspectorName: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: QualityInspectionItem[];
  template?: QualityTemplate | null | undefined;
  warehouse?: { id: number; name: string; code: string } | null;
}

export interface CreateInspectionInput {
  inspectionType: QualityInspectionType;
  sourceId?: number | undefined;
  productId?: number | undefined;
  warehouseId?: number | undefined;
  quantity?: number | undefined;
  templateId?: number | undefined;
  priority?: (typeof QUALITY_PRIORITIES)[number] | undefined;
  notes?: string | undefined;
}

export interface RecordItemResultInput {
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  manualHold?: boolean | undefined;
  condition?: (typeof QUALITY_CONDITIONS)[number] | undefined;
  defectCode?: string | undefined;
  defectDescription?: string | undefined;
  disposition?: QualityDisposition | undefined;
  notes?: string | undefined;
  checkpointResults?: CheckpointResult[] | undefined;
}

export interface QuerySourcesInput {
  inspectionType: QualityInspectionType;
}
export interface InspectionSource {
  id: number;
  number: string;
  party: string | null;
}

export interface QueryInspectionInput {
  page: number;
  limit: number;
  q?: string | undefined;
  inspectionType?: QualityInspectionType | undefined;
  status?: QualityInspectionStatus | undefined;
}
export interface QueryDefectInput {
  page: number;
  limit: number;
  q?: string | undefined;
  severity?: DefectSeverity | undefined;
  category?: string | undefined;
  active?: boolean | undefined;
}
export interface QueryTemplateInput {
  page: number;
  limit: number;
  q?: string | undefined;
  inspectionType?: QualityInspectionType | undefined;
  active?: boolean | undefined;
}
export interface QueryQuarantineInput {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: (typeof QUARANTINE_STATUSES)[number] | undefined;
}

export interface QuarantineRecord {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  batchId: number | null;
  batchNumber: string | null;
  serialNumbers: string[];
  warehouseId: number;
  locationId: number | null;
  quantity: string;
  sourceType: string;
  sourceId: number | null;
  sourceNumber: string | null;
  inspectionId: number | null;
  inspectionNumber: string | null;
  defectCode: string | null;
  reason: string | null;
  status: (typeof QUARANTINE_STATUSES)[number];
  quarantineDate: string;
  reviewedAt: string | null;
  releasedAt: string | null;
  releaseLedgerEntryId: number | null;
  rejectedAt: string | null;
  rejectLedgerEntryId: number | null;
  notes: string | null;
  createdAt: string;
  warehouse?: { id: number; name: string; code: string };
}

export interface QualityDashboard {
  byStatus: Record<string, number>;
  byResult: Record<string, number>;
  completedToday: number;
  quarantinedActive: number;
  criticalDefects: number;
  avgInspectionMinutes: number | null;
  pending: QualityInspection[];
  recent: QualityInspection[];
  topDefects: { defectCode: string; count: number }[];
}

export interface ScmActivityRow {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  at: string;
  byName: string | null;
}
