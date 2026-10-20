const fs = require("node:fs");
const path = require("node:path");
const tseslint = require("typescript-eslint");
const importX = require("eslint-plugin-import-x");
const shared = require("@texawave-erp/config/eslint.config.js");

const MODULES_DIR = path.join(__dirname, "src/modules");
const moduleNames = fs.existsSync(MODULES_DIR)
  ? fs
      .readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

// One zone per module (Phase 4: "feature modules must not import another
// module's private repository"). Generated from the filesystem so this stays
// correct as modules are added/removed — nobody has to remember to update an
// allowlist by hand. A module may still import its OWN repository files; the
// zone below only forbids reaching into a *sibling* module's repository.
const modulePrivacyZones = moduleNames
  .map((name) => ({
    target: `./src/modules/${name}/**/*`,
    from: moduleNames
      .filter((other) => other !== name)
      .map((other) => `./src/modules/${other}/**/*.repository.ts`),
    message:
      "A module may not import another module's repository directly — use EventEmitter2 for async side effects, or a module's exported public service for a necessary synchronous read (see CODING_STANDARDS.md §11).",
  }))
  // A module with no siblings yet has nothing to restrict against — the
  // rule's schema rejects an empty `from` array, and it would be a no-op
  // anyway.
  .filter((zone) => zone.from.length > 0);

module.exports = tseslint.config(
  ...shared,
  {
    // Legacy reference-only source trees (copied verbatim from the old
    // Firebase/Vite app for migration-audit purposes, never meant to build
    // or run here) — excluded from tsconfig.json/tsconfig.build.json's
    // `include` for the same reason, so typescript-eslint's project
    // service has nowhere to place them and fails to parse every file
    // otherwise. Keep this list in sync with those two tsconfig excludes.
    ignores: [
      "src/modules/crm/*.tsx",
      "src/modules/crm/bulkImport/**",
      "src/modules/crm/celebration/**",
      "src/modules/crm/components/**",
      "src/modules/crm/domain/**",
      "src/modules/crm/importExport/**",
      "src/modules/crm/intelligence/**",
      "src/modules/crm/notifications/**",
      "src/modules/crm/types.ts",
      "src/modules/crm/useOverallDataLive.ts",
      "src/modules/finance/**",
      "src/modules/projects/**",
      "src/modules/sales/**",
      "src/modules/scm/SCMLayout.tsx",
      "src/modules/scm/advanced/AdvancedScmSummary.tsx",
      "src/modules/scm/advanced/ScmActionCenter.tsx",
      "src/modules/scm/advanced/ScmControlTower.tsx",
      "src/modules/scm/advanced/ScmInventoryIntelligence.tsx",
      "src/modules/scm/advanced/ScmReplenishment.tsx",
      "src/modules/scm/advanced/ScmSupplierIntelligence.tsx",
      "src/modules/scm/advanced/advancedHelpers.ts",
      "src/modules/scm/advanced/advancedPaths.ts",
      "src/modules/scm/advanced/advancedTypes.ts",
      "src/modules/scm/advanced/exceptionEngine.ts",
      "src/modules/scm/advanced/inventoryIntelligenceService.ts",
      "src/modules/scm/advanced/replenishmentService.ts",
      "src/modules/scm/advanced/scmAutomationService.ts",
      "src/modules/scm/advanced/supplierIntelligenceService.ts",
      "src/modules/scm/advanced/useControlTowerData.ts",
      "src/modules/scm/ai/components/ScmAiChatbot.tsx",
      "src/modules/scm/ai/components/ScmAiInput.tsx",
      "src/modules/scm/ai/components/ScmAiMessage.tsx",
      "src/modules/scm/ai/components/ScmAiSuggestions.tsx",
      "src/modules/scm/ai/scmAiContext.ts",
      "src/modules/scm/ai/scmAiHistory.ts",
      "src/modules/scm/ai/scmAiIntent.ts",
      "src/modules/scm/ai/scmAiPrompts.ts",
      "src/modules/scm/ai/scmAiService.ts",
      "src/modules/scm/ai/scmAiTypes.ts",
      "src/modules/scm/barcode/ScmBarcodeDashboard.tsx",
      "src/modules/scm/barcode/barcodeHelpers.ts",
      "src/modules/scm/barcode/barcodeResolver.ts",
      "src/modules/scm/barcode/barcodeService.ts",
      "src/modules/scm/barcode/barcodeTypes.ts",
      "src/modules/scm/barcode/components/ScmBarcode.tsx",
      "src/modules/scm/barcode/components/ScmBarcodeGenerator.tsx",
      "src/modules/scm/barcode/components/ScmBarcodeHistory.tsx",
      "src/modules/scm/barcode/components/ScmBarcodeLabel.tsx",
      "src/modules/scm/barcode/components/ScmBarcodeResult.tsx",
      "src/modules/scm/barcode/components/ScmBarcodeScanner.tsx",
      "src/modules/scm/barcode/components/ScmQrCode.tsx",
      "src/modules/scm/components/ScmAutocomplete.tsx",
      "src/modules/scm/components/ScmSidebar.tsx",
      "src/modules/scm/components/ScmSidebarDesktop.tsx",
      "src/modules/scm/demo/ScmDemoData.tsx",
      "src/modules/scm/demo/demoSeedData.ts",
      "src/modules/scm/demo/demoSeedService.ts",
      "src/modules/scm/inventory/OpeningBalanceDialog.tsx",
      "src/modules/scm/inventory/ScmAdjustments.tsx",
      "src/modules/scm/inventory/ScmBatches.tsx",
      "src/modules/scm/inventory/ScmInventoryDetail.tsx",
      "src/modules/scm/inventory/ScmReservations.tsx",
      "src/modules/scm/inventory/ScmSerialNumbers.tsx",
      "src/modules/scm/inventory/ScmStockLedgerPage.tsx",
      "src/modules/scm/inventory/ScmStockOverview.tsx",
      "src/modules/scm/inventory/ScmTransfers.tsx",
      "src/modules/scm/inventory/batchSerialService.ts",
      "src/modules/scm/inventory/inventoryPaths.ts",
      "src/modules/scm/inventory/productCatalog.ts",
      "src/modules/scm/inventory/stockLedgerService.ts",
      "src/modules/scm/inventory/useInventoryData.ts",
      "src/modules/scm/logistics/ScmCarriers.tsx",
      "src/modules/scm/logistics/ScmDeliveries.tsx",
      "src/modules/scm/logistics/ScmLogisticsDashboard.tsx",
      "src/modules/scm/logistics/ScmShipmentDetail.tsx",
      "src/modules/scm/logistics/ScmShipments.tsx",
      "src/modules/scm/logistics/ScmTracking.tsx",
      "src/modules/scm/logistics/components/ShipmentDialogs.tsx",
      "src/modules/scm/logistics/logisticsHelpers.ts",
      "src/modules/scm/logistics/logisticsPaths.ts",
      "src/modules/scm/logistics/logisticsService.ts",
      "src/modules/scm/masterData/ScmMasterData.tsx",
      "src/modules/scm/masterData/masterDataTypes.ts",
      "src/modules/scm/masterData/scmMasterDataService.ts",
      "src/modules/scm/masterData/useScmMasterData.ts",
      "src/modules/scm/nav.ts",
      "src/modules/scm/orders/ScmAllocation.tsx",
      "src/modules/scm/orders/ScmBackorders.tsx",
      "src/modules/scm/orders/ScmOrderFulfillmentDashboard.tsx",
      "src/modules/scm/orders/ScmOrderFulfillmentDetail.tsx",
      "src/modules/scm/orders/ScmSalesOrdersFulfillment.tsx",
      "src/modules/scm/orders/fulfillmentReservations.ts",
      "src/modules/scm/orders/fulfillmentShippingStatus.ts",
      "src/modules/scm/orders/fulfillmentStore.ts",
      "src/modules/scm/orders/orderFulfillmentService.ts",
      "src/modules/scm/orders/orderHelpers.ts",
      "src/modules/scm/orders/orderPaths.ts",
      "src/modules/scm/overview/ScmFlowErrorBoundary.tsx",
      "src/modules/scm/overview/ScmOverview.tsx",
      "src/modules/scm/overview/ScmSupplyChainFlow.tsx",
      "src/modules/scm/overview/ScmSupplyChainList.tsx",
      "src/modules/scm/overview/scmFlowNodes.ts",
      "src/modules/scm/overview/scmStageIcons.tsx",
      "src/modules/scm/overview/useScmOverviewData.ts",
      "src/modules/scm/procurement/GrnReceiveDialog.tsx",
      "src/modules/scm/procurement/PurchaseOrderFormDialog.tsx",
      "src/modules/scm/procurement/RequisitionFormDialog.tsx",
      "src/modules/scm/procurement/ScmGrn.tsx",
      "src/modules/scm/procurement/ScmProcurementDashboard.tsx",
      "src/modules/scm/procurement/ScmPurchaseOrders.tsx",
      "src/modules/scm/procurement/ScmPurchaseRequisitions.tsx",
      "src/modules/scm/procurement/ScmQuotationComparison.tsx",
      "src/modules/scm/procurement/ScmRfqs.tsx",
      "src/modules/scm/procurement/ScmSupplierQuotations.tsx",
      "src/modules/scm/procurement/ShortageRequisitionDialog.tsx",
      "src/modules/scm/procurement/grnService.ts",
      "src/modules/scm/procurement/procurementHelpers.ts",
      "src/modules/scm/procurement/procurementPaths.ts",
      "src/modules/scm/procurement/purchaseOrderService.ts",
      "src/modules/scm/procurement/quotationService.ts",
      "src/modules/scm/procurement/requisitionForm.ts",
      "src/modules/scm/quality/RecordItemResultDialog.tsx",
      "src/modules/scm/quality/ScmQualityActivity.tsx",
      "src/modules/scm/quality/ScmQualityDashboard.tsx",
      "src/modules/scm/quality/ScmQualityDefects.tsx",
      "src/modules/scm/quality/ScmQualityInspectionDetail.tsx",
      "src/modules/scm/quality/ScmQualityInspections.tsx",
      "src/modules/scm/quality/ScmQualityQuarantine.tsx",
      "src/modules/scm/quality/ScmQualityTemplates.tsx",
      "src/modules/scm/quality/inspectionService.ts",
      "src/modules/scm/quality/qualityHelpers.ts",
      "src/modules/scm/quality/qualityMasterService.ts",
      "src/modules/scm/quality/qualityPaths.ts",
      "src/modules/scm/quality/quarantineService.ts",
      "src/modules/scm/quality/useQualityData.ts",
      "src/modules/scm/reports/ScmFulfillmentReport.tsx",
      "src/modules/scm/reports/ScmInventoryReport.tsx",
      "src/modules/scm/reports/ScmLogisticsReport.tsx",
      "src/modules/scm/reports/ScmProcurementReport.tsx",
      "src/modules/scm/reports/ScmQualityReport.tsx",
      "src/modules/scm/reports/ScmReportsDashboard.tsx",
      "src/modules/scm/reports/ScmReturnsReport.tsx",
      "src/modules/scm/reports/ScmSupplierReport.tsx",
      "src/modules/scm/reports/ScmWarehouseReport.tsx",
      "src/modules/scm/reports/calculations/executive.ts",
      "src/modules/scm/reports/calculations/fulfillment.ts",
      "src/modules/scm/reports/calculations/index.ts",
      "src/modules/scm/reports/calculations/inventory.ts",
      "src/modules/scm/reports/calculations/logistics.ts",
      "src/modules/scm/reports/calculations/procurement.ts",
      "src/modules/scm/reports/calculations/quality.ts",
      "src/modules/scm/reports/calculations/returns.ts",
      "src/modules/scm/reports/calculations/shared.ts",
      "src/modules/scm/reports/calculations/suppliers.ts",
      "src/modules/scm/reports/calculations/warehouse.ts",
      "src/modules/scm/reports/reportCalculations.ts",
      "src/modules/scm/reports/reportComponents.tsx",
      "src/modules/scm/reports/reportExport.ts",
      "src/modules/scm/reports/reportHelpers.ts",
      "src/modules/scm/reports/reportPaths.ts",
      "src/modules/scm/reports/reportService.ts",
      "src/modules/scm/returns/DispositionSummary.tsx",
      "src/modules/scm/returns/ReturnActionDialogs.tsx",
      "src/modules/scm/returns/ScmCustomerReturns.tsx",
      "src/modules/scm/returns/ScmReturnDetail.tsx",
      "src/modules/scm/returns/ScmReturnDisposition.tsx",
      "src/modules/scm/returns/ScmReturnInspection.tsx",
      "src/modules/scm/returns/ScmReturnsDashboard.tsx",
      "src/modules/scm/returns/ScmReturnsList.tsx",
      "src/modules/scm/returns/ScmVendorReturns.tsx",
      "src/modules/scm/returns/customerReturnDispositionService.ts",
      "src/modules/scm/returns/customerReturnService.ts",
      "src/modules/scm/returns/returnHelpers.ts",
      "src/modules/scm/returns/returnsData.ts",
      "src/modules/scm/returns/returnsMasterService.ts",
      "src/modules/scm/returns/returnsPaths.ts",
      "src/modules/scm/returns/vendorReturnService.ts",
      "src/modules/scm/shared/actionLock.ts",
      "src/modules/scm/shared/actor.ts",
      "src/modules/scm/shared/businessRules.ts",
      "src/modules/scm/shared/components/DashboardKpiGrid.tsx",
      "src/modules/scm/shared/components/DetailRow.tsx",
      "src/modules/scm/shared/components/ScmButton.tsx",
      "src/modules/scm/shared/components/ScmTable.tsx",
      "src/modules/scm/shared/crossModulePaths.ts",
      "src/modules/scm/shared/format.ts",
      "src/modules/scm/shared/statusTransition.ts",
      "src/modules/scm/shared/useAsyncAction.ts",
      "src/modules/scm/shared/useErrorToast.ts",
      "src/modules/scm/suppliers/ScmSupplierDetail.tsx",
      "src/modules/scm/suppliers/ScmSupplierFormDialog.tsx",
      "src/modules/scm/suppliers/ScmSuppliers.tsx",
      "src/modules/scm/suppliers/SupplierProcurementTabs.tsx",
      "src/modules/scm/suppliers/supplierHelpers.ts",
      "src/modules/scm/warehouse/ScmLocations.tsx",
      "src/modules/scm/warehouse/ScmPutaway.tsx",
      "src/modules/scm/warehouse/ScmWarehouseActivity.tsx",
      "src/modules/scm/warehouse/ScmWarehouseDashboard.tsx",
      "src/modules/scm/warehouse/ScmWarehouseFormDialog.tsx",
      "src/modules/scm/warehouse/ScmWarehouseMovements.tsx",
      "src/modules/scm/warehouse/ScmWarehousePacking.tsx",
      "src/modules/scm/warehouse/ScmWarehousePicking.tsx",
      "src/modules/scm/warehouse/ScmWarehouseStock.tsx",
      "src/modules/scm/warehouse/ScmWarehouses.tsx",
      "src/modules/scm/warehouse/warehouseHelpers.ts",
      "src/modules/scm/warehouse/warehousePaths.ts",
    ],
  },
  {
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      "import-x/resolver": { node: { extensions: [".js", ".ts"] } },
    },
    rules: {
      // Type-aware rules (Phase 5): unsafe `any`/casts and unhandled promises
      // are exactly the two classes of bug that silent-any and fire-and-forget
      // async calls produce in a NestJS request pipeline.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "import-x/no-cycle": ["error", { maxDepth: Infinity, ignoreExternal: true }],
    },
  },
  {
    // Controllers must not query Prisma (Phase 6 / CODING_STANDARDS.md §3):
    // route through the service, which routes through the repository.
    files: ["src/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@prisma/client/*",
                "**/generated/prisma/**",
                "@texawave-erp/database/generated/*",
                "**/shared/prisma/**",
              ],
              message:
                "Controllers must not touch Prisma or PrismaService directly — call the service, which calls the repository.",
            },
          ],
        },
      ],
    },
  },
  {
    // Only *.repository.ts files (and the shared Prisma provider itself) may
    // call PrismaService — CODING_STANDARDS.md §3.
    files: ["src/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@prisma/client/*", "**/generated/prisma/**"],
              message:
                "Services must not import Prisma directly — that's the repository's job. Inject the repository instead.",
            },
          ],
        },
      ],
    },
  },
  ...(modulePrivacyZones.length > 0
    ? [
        {
          files: ["src/modules/**/*.ts"],
          rules: {
            "import-x/no-restricted-paths": [
              "error",
              { zones: modulePrivacyZones, basePath: __dirname },
            ],
          },
        },
      ]
    : []),
);
