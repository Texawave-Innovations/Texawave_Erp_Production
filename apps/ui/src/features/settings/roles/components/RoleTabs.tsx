"use client";

export type RoleTabKey = "permissions" | "users";

export interface RoleTabsProps {
  activeTab: RoleTabKey;
  onTabChange: (tab: RoleTabKey) => void;
  assignedUsersCount: number;
}

export function RoleTabs({
  activeTab,
  onTabChange,
  assignedUsersCount,
}: RoleTabsProps) {
  const tabs: Array<{
    key: RoleTabKey;
    label: string;
    icon: string;
    count?: number;
  }> = [
    {
      key: "permissions",
      label: "Permissions",
      icon: "🔒",
    },
    {
      key: "users",
      label: `Users (${assignedUsersCount})`,
      icon: "👥",
    },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <nav
        className="-mb-px flex space-x-8"
        aria-label="Role management sections"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-2 border-b-2 py-3.5 text-theme-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                isActive
                  ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span
                className={isActive ? "text-brand-600 dark:text-brand-400" : ""}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
