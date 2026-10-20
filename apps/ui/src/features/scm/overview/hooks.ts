"use client";

import type {
  AssistantAnswer,
  ControlTowerException,
  MasterDataHit,
  ReplenishmentRow,
  ScmOverview,
} from "@texawave-erp/api-types";
import { scmGet, scmPost } from "../shared/scm-api";
import { useScmData, useScmMutation } from "../shared/scm-hooks";

export const useScmOverview = () =>
  useScmData<ScmOverview>("overview", ["overview"], () =>
    scmGet("/scm/overview"),
  );

export const useMasterDataSearch = (q: string) =>
  useScmData<MasterDataHit[]>(
    "overview",
    ["master-data", q],
    () => scmGet("/scm/master-data/search", { q }),
    q.trim().length > 0,
  );

export const useResolveBarcode = () =>
  useScmMutation((code: string) =>
    scmPost<MasterDataHit>("/scm/barcode/resolve", { code }),
  );

export const useControlTower = () =>
  useScmData<ControlTowerException[]>("overview", ["control-tower"], () =>
    scmGet("/scm/advanced/control-tower"),
  );

export const useReplenishment = () =>
  useScmData<ReplenishmentRow[]>("overview", ["replenishment"], () =>
    scmGet("/scm/advanced/replenishment"),
  );

export const useAssistantAsk = () =>
  useScmMutation((question: string) =>
    scmPost<AssistantAnswer>("/scm/assistant/ask", { question }),
  );
