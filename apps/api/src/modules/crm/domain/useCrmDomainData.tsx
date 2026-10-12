// CRM Core Domain — one hook subscribing to every domain collection at once, mirroring the shape
// of `intelligence/useCrmSourceData.ts` so Dashboard/Search/Calendar/Analytics can read both the
// legacy sheet data and the new relational domain the same way.
//
// Every top-level CRM page AND several components nested deep inside them (LeadConvertDialog,
// OpportunityDrawer, ChannelActivityQueue, AccountStatusQueue, LogToAccountButton) call
// `useCrmDomainData()`. Left as a plain hook, opening one of those nested dialogs while its parent
// page is mounted would open a second full set of ~12 live listeners on the exact same
// collections, for no benefit — so the actual subscription lives in `CrmDomainDataProvider`
// (mounted once in `CRMLayout.tsx`), and `useCrmDomainData()` itself is just a Context read. Every
// existing call site keeps working unchanged — same hook name, same returned shape.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeCrmAccounts } from "./accountsService";
import { subscribeCrmContacts } from "./contactsService";
import { subscribeCrmOpportunities } from "./opportunitiesService";
import { subscribeCrmActivities } from "./activitiesService";
import { subscribeCrmFollowUps } from "./followupsService";
import { subscribeCrmMeetings } from "./meetingsService";
import { subscribeCrmTasks } from "./tasksService";
import {
  subscribeCrmQuotations,
  subscribeCrmAllQuotationItems,
} from "./quotationsService";
import { subscribeCrmDocuments } from "./documentsService";
import { subscribeCrmProducts } from "./productsService";
import { subscribeCrmDealProducts } from "./dealProductsService";
import { subscribeCrmQuotas } from "./quotasService";
import {
  CrmAccount,
  CrmActivity,
  CrmContact,
  CrmDealProduct,
  CrmDocument,
  CrmFollowUp,
  CrmMeeting,
  CrmOpportunity,
  CrmProduct,
  CrmQuota,
  CrmQuotation,
  CrmQuotationLineItem,
  CrmTask,
} from "./types";

export interface CrmDomainData {
  accounts: CrmAccount[];
  contacts: CrmContact[];
  opportunities: CrmOpportunity[];
  activities: CrmActivity[];
  followUps: CrmFollowUp[];
  meetings: CrmMeeting[];
  tasks: CrmTask[];
  quotations: CrmQuotation[];
  documents: CrmDocument[];
  products: CrmProduct[];
  dealProducts: CrmDealProduct[];
  quotationItems: CrmQuotationLineItem[];
  quotas: CrmQuota[];
}

const EMPTY: CrmDomainData = {
  accounts: [],
  contacts: [],
  opportunities: [],
  activities: [],
  followUps: [],
  meetings: [],
  tasks: [],
  quotations: [],
  documents: [],
  products: [],
  dealProducts: [],
  quotationItems: [],
  quotas: [],
};

function useCrmDomainDataSubscription(): CrmDomainData & { loading: boolean } {
  const [data, setData] = useState<CrmDomainData>(EMPTY);
  const [loaded, setLoaded] = useState<Record<keyof CrmDomainData, boolean>>({
    accounts: false,
    contacts: false,
    opportunities: false,
    activities: false,
    followUps: false,
    meetings: false,
    tasks: false,
    quotations: false,
    documents: false,
    products: false,
    dealProducts: false,
    quotationItems: false,
    quotas: false,
  });

  useEffect(() => {
    const mark = (key: keyof CrmDomainData) =>
      setLoaded((prev) => ({ ...prev, [key]: true }));

    const unsubscribers = [
      subscribeCrmAccounts((accounts) => {
        setData((prev) => ({ ...prev, accounts }));
        mark("accounts");
      }),
      subscribeCrmContacts((contacts) => {
        setData((prev) => ({ ...prev, contacts }));
        mark("contacts");
      }),
      subscribeCrmOpportunities((opportunities) => {
        setData((prev) => ({ ...prev, opportunities }));
        mark("opportunities");
      }),
      subscribeCrmActivities((activities) => {
        setData((prev) => ({ ...prev, activities }));
        mark("activities");
      }),
      subscribeCrmFollowUps((followUps) => {
        setData((prev) => ({ ...prev, followUps }));
        mark("followUps");
      }),
      subscribeCrmMeetings((meetings) => {
        setData((prev) => ({ ...prev, meetings }));
        mark("meetings");
      }),
      subscribeCrmTasks((tasks) => {
        setData((prev) => ({ ...prev, tasks }));
        mark("tasks");
      }),
      subscribeCrmQuotations((quotations) => {
        setData((prev) => ({ ...prev, quotations }));
        mark("quotations");
      }),
      subscribeCrmDocuments((documents) => {
        setData((prev) => ({ ...prev, documents }));
        mark("documents");
      }),
      subscribeCrmProducts((products) => {
        setData((prev) => ({ ...prev, products }));
        mark("products");
      }),
      subscribeCrmDealProducts((dealProducts) => {
        setData((prev) => ({ ...prev, dealProducts }));
        mark("dealProducts");
      }),
      subscribeCrmAllQuotationItems((quotationItems) => {
        setData((prev) => ({ ...prev, quotationItems }));
        mark("quotationItems");
      }),
      subscribeCrmQuotas((quotas) => {
        setData((prev) => ({ ...prev, quotas }));
        mark("quotas");
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const loading = Object.values(loaded).some((v) => !v);
  return { ...data, loading };
}

const CrmDomainDataContext = createContext<
  (CrmDomainData & { loading: boolean }) | null
>(null);

/** Mounted once in `CRMLayout.tsx`, wrapping every routed CRM page — the one place the actual
 *  ~12 Firebase listeners are opened for the whole module. */
export function CrmDomainDataProvider({ children }: { children: ReactNode }) {
  const value = useCrmDomainDataSubscription();
  return (
    <CrmDomainDataContext.Provider value={value}>
      {children}
    </CrmDomainDataContext.Provider>
  );
}

export function useCrmDomainData(): CrmDomainData & { loading: boolean } {
  const ctx = useContext(CrmDomainDataContext);
  if (!ctx)
    throw new Error(
      "useCrmDomainData must be used within a CrmDomainDataProvider (mounted in CRMLayout.tsx)",
    );
  return ctx;
}
