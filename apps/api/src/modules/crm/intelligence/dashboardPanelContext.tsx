// Shared state for the CRM Dashboard's Search/Calendar toggle. The buttons that flip this live in
// CRMLayout.tsx's top header (next to the notification bell) rather than inside CrmDashboard.tsx's
// own section header, so a Context keeps the two in sync without lifting the rest of the
// Dashboard's state up into the layout. The toggle only renders in the header while the Dashboard
// tab is active — CrmDashboard.tsx is what actually swaps in the inline CrmSearch/CrmCalendar view
// in place of the regular dashboard sections.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CrmDashboardPanel = "search" | "calendar" | null;

interface CrmDashboardPanelContextValue {
  activePanel: CrmDashboardPanel;
  setActivePanel: (
    panel: CrmDashboardPanel | ((prev: CrmDashboardPanel) => CrmDashboardPanel),
  ) => void;
}

const CrmDashboardPanelContext =
  createContext<CrmDashboardPanelContextValue | null>(null);

export function CrmDashboardPanelProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activePanel, setActivePanel] = useState<CrmDashboardPanel>(null);
  const value = useMemo(() => ({ activePanel, setActivePanel }), [activePanel]);
  return (
    <CrmDashboardPanelContext.Provider value={value}>
      {children}
    </CrmDashboardPanelContext.Provider>
  );
}

export function useCrmDashboardPanel(): CrmDashboardPanelContextValue {
  const ctx = useContext(CrmDashboardPanelContext);
  if (!ctx)
    throw new Error(
      "useCrmDashboardPanel must be used within a CrmDashboardPanelProvider",
    );
  return ctx;
}
