import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import Icon from "../common/Icon.jsx";

export const ADMIN_TABS = [
  { id: "Overview", label: "Overview", icon: "Overview" },
  { id: "Workstations", label: "Workstation Fleet", icon: "Workstations" },
  { id: "Software Inventory", label: "Software Catalog", icon: "Software Inventory" },
  { id: "System Health", label: "System Health", icon: "System Health" },
  { id: "Alerts", label: "Alerts", icon: "Alerts", hasBadge: true },
  { id: "Maintenance", label: "Maintenance", icon: "Maintenance" },
  { id: "Reports", label: "Reports", icon: "Reports" },
  { id: "Accounts", label: "Accounts", icon: "Accounts" }
];

export default function AdminNavTabs({ alerts = [] }) {
  const { page, setPage, setSelectedWorkstationId, setSelectedLabName } = useApp();

  const unresolvedAlertsCount = alerts.filter((a) => !a.resolvedAt).length;

  function handleTabClick(tabId) {
    setPage(tabId);
    setSelectedWorkstationId("");
    setSelectedLabName("");
  }

  return (
    <nav className="admin-subnav-wrapper" aria-label="Admin navigation tabs">
      <div className="admin-subnav-scroll">
        {ADMIN_TABS.map((tab) => {
          const isActive = page === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`admin-subnav-tab ${isActive ? "active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
              {tab.hasBadge && unresolvedAlertsCount > 0 && (
                <span
                  className="admin-subnav-badge"
                  title={`${unresolvedAlertsCount} unresolved alerts`}
                >
                  {unresolvedAlertsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
