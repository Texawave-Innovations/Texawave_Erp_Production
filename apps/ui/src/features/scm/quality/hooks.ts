"use client";

import type {
  CreateDefectInput,
  CreateInspectionInput,
  CreateTemplateInput,
  InspectionSource,
  QualityDashboard,
  QualityDefect,
  QualityInspection,
  QualityTemplate,
  QueryDefectInput,
  QueryInspectionInput,
  QueryQuarantineInput,
  QueryTemplateInput,
  QuarantineRecord,
  RecordItemResultInput,
  ScmActivityRow,
  UpdateDefectInput,
  UpdateTemplateInput,
} from "@texawave-erp/api-types";
import { scmGet, scmPatch, scmPost, scmPut } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

const Q = "/scm/quality";

export const useQualityDashboard = () =>
  useScmData<QualityDashboard>("quality", ["dashboard"], () =>
    scmGet(`${Q}/dashboard`),
  );
export const useQualityActivity = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
}) => useScmList<ScmActivityRow>("quality", `${Q}/activity`, q);

export const useDefects = (q: QueryDefectInput) =>
  useScmList<QualityDefect>("quality-defects", `${Q}/defects`, q);
export const useCreateDefect = () =>
  useScmMutation((input: CreateDefectInput) =>
    scmPost<QualityDefect>(`${Q}/defects`, input),
  );
export const useUpdateDefect = () =>
  useScmMutation(({ id, input }: { id: number; input: UpdateDefectInput }) =>
    scmPatch<QualityDefect>(`${Q}/defects/${id}`, input),
  );

export const useTemplates = (q: QueryTemplateInput) =>
  useScmList<QualityTemplate>("quality-templates", `${Q}/templates`, q);
export const useTemplate = (id: number | null) =>
  useScmData<QualityTemplate>(
    "quality-templates",
    ["one", id ?? 0],
    () => scmGet(`${Q}/templates/${id}`),
    id !== null,
  );
export const useCreateTemplate = () =>
  useScmMutation((input: CreateTemplateInput) =>
    scmPost<QualityTemplate>(`${Q}/templates`, input),
  );
export const useUpdateTemplate = () =>
  useScmMutation(({ id, input }: { id: number; input: UpdateTemplateInput }) =>
    scmPatch<QualityTemplate>(`${Q}/templates/${id}`, input),
  );

export const useInspections = (q: QueryInspectionInput) =>
  useScmList<QualityInspection>("quality-inspections", `${Q}/inspections`, q);
export const useInspection = (id: number | null) =>
  useScmData<QualityInspection>(
    "quality-inspections",
    ["one", id ?? 0],
    () => scmGet(`${Q}/inspections/${id}`),
    id !== null,
  );
export const useInspectionSources = (type: string | null) =>
  useScmData<InspectionSource[]>(
    "quality-inspections",
    ["sources", type ?? ""],
    () => scmGet(`${Q}/inspections/sources`, { inspectionType: type }),
    type !== null,
  );
export const useCreateInspection = () =>
  useScmMutation((input: CreateInspectionInput) =>
    scmPost<QualityInspection>(`${Q}/inspections`, input),
  );
export const useInspectionAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action: "start" | "cancel" | "complete";
      body?: object | undefined;
    }) => scmPost<QualityInspection>(`${Q}/inspections/${id}/${action}`, body),
  );
export const useRecordItemResult = () =>
  useScmMutation(
    ({
      inspectionId,
      itemId,
      input,
    }: {
      inspectionId: number;
      itemId: number;
      input: RecordItemResultInput;
    }) =>
      scmPut<QualityInspection>(
        `${Q}/inspections/${inspectionId}/items/${itemId}`,
        input,
      ),
  );

export const useQuarantine = (q: QueryQuarantineInput) =>
  useScmList<QuarantineRecord>("quarantine", `${Q}/quarantine`, q);
export const useQuarantineAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action: "review" | "release" | "reject";
      body?: object | undefined;
    }) => scmPost<QuarantineRecord>(`${Q}/quarantine/${id}/${action}`, body),
  );
