"use client";

import type {
  AssistantAnswer,
  BarcodeProductRow,
  ControlTowerException,
  MasterDataHit,
  ReplenishmentRow,
  ScanResult,
  ScmOverview,
} from "@texawave-erp/api-types";
import { useMutation } from "@tanstack/react-query";
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

/** Resolves a scanned/typed code into a full result card. Read-only, so it
 * does not invalidate any cached SCM data. */
export const useScanCode = () =>
  useMutation({
    mutationFn: (code: string) =>
      scmPost<ScanResult>("/scm/barcode/scan", { code }),
  });

/** Products with barcode, bin and expiry for the Barcode Utilities table. */
export const useBarcodeProducts = (q: string) =>
  useScmData<BarcodeProductRow[]>("overview", ["barcode-products", q], () =>
    scmGet("/scm/barcode/products", q ? { q } : undefined),
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
