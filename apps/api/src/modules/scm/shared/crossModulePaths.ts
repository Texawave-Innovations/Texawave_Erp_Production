/** Firebase paths owned by other ERP modules that SCM reads (and, for vendors and sales-order
 *  shipped status, writes). SCM-owned paths live in each domain's `*Paths.ts`. */
export const SCM_CROSS_MODULE_PATHS = {
  vendors: "contacts/vendors",
  products: "sales/products",
  salesOrders: "sales/orderAcknowledgements",
  legacyPurchaseOrders: "purchases/purchaseOrders",
} as const;
