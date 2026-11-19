import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import AdminWorkstationTable from "../../components/admin/AdminWorkstationTable.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import Badge from "../../components/common/Badge.jsx";

export default function AdminOverview({
  dashboard = {},
  workstations = [],
  alerts = []
}) {
  const {
    adminSearch,
    setAdminSearch,
    adminStatus,
    setAdminStatus,
    openWorkstation,
    reconnectWorkstation,
    revokeWorkstation,
    deleteWorkstation,
    toggleMaintenance
  } = useApp();

  const [alertPage, setAlertPage] = useState(0);
  const alertPageSize = 8;

  const query = adminSearch.trim().toLowerCase();
  const filteredStations = workstations.filter((item) => {
    const matchesStatus = !adminStatus || item.status === adminStatus;
    const searchable = [
      item.id,
      item.hostname,
      item.lab,
      item.room,
      item.os,
      ...(item.software || []).map(
        (s) => `${s.name} ${s.version} ${s.publisher}`
      )
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!query || searchable.includes(query));
  });

  const unresolvedAlerts = alerts.filter((a) => !a.resolvedAt);
  const matchedAlerts = unresolvedAlerts.filter(
    (item) =>
      !query ||
      `${item.kind} ${item.message} ${item.workstationId}`
        .toLowerCase()
        .includes(query)
  );

  const safeAlertPage = Math.min(
    alertPage,
    Math.max(0, Math.ceil(matchedAlerts.length / alertPageSize) - 1)
  );
  const paginatedAlerts = matchedAlerts.slice(
    safeAlertPage * alertPageSize,
    safeAlertPage * alertPageSize + alertPageSize
  );

  function handleToggleDetails(expand) {
    document
      .querySelectorAll("#page-content details")
      .forEach((d) => (d.open = expand));
  }

  return (
    <div className="admin-view">
      {/* Overview Metrics Section */}
      <section className="panel">
        <div className="panel-header section-header">
          <div>
            <p className="eyebrow">Current agent reports</p>
            <h2>Workstation overview</h2>
          </div>
          <span className="demo-tag">Live API · reported data</span>
        </div>
        <div className="metric-row four-up">
          <div className="metric-box">
            <span>Registered PCs</span>
            <strong>{dashboard.total || 0}</strong>
          </div>
          <div className="metric-box success">
            <span>Available</span>
            <strong>{dashboard.counts?.Available || 0}</strong>
          </div>
          <div className="metric-box info">
            <span>In use</span>
            <strong>{dashboard.counts?.["In use"] || 0}</strong>
          </div>
          <div className="metric-box warning">
            <span>Idle</span>
            <strong>{dashboard.counts?.Idle || 0}</strong>
          </div>
          <div className="metric-box danger">
            <span>Offline</span>
            <strong>{dashboard.counts?.Offline || 0}</strong>
          </div>
          <div className="metric-box neutral">
            <span>Maintenance</span>
            <strong>{dashboard.counts?.Maintenance || 0}</strong>
          </div>
        </div>
      </section>

      {/* Workstation Directory Panel */}
      <section className="panel admin-table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Workstation directory</p>
            <h3>Latest device reports</h3>
          </div>
        </div>

        <AdminSearchForm
          search={adminSearch}
          status={adminStatus}
          onSearchChange={setAdminSearch}
          onStatusChange={setAdminStatus}
          onClear={() => {
            setAdminSearch("");
            setAdminStatus("");
          }}
          statuses
        />

        <div className="record-tools">
          <span className="muted-copy">
            Expand a record for grouped details.
          </span>
          <div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => handleToggleDetails(true)}
            >
              Expand all
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => handleToggleDetails(false)}
            >
              Collapse all
            </button>
          </div>
        </div>

        <AdminWorkstationTable
          workstations={filteredStations}
          onOpenWorkstation={openWorkstation}
          onReconnect={reconnectWorkstation}
          onToggleMaintenance={toggleMaintenance}
          onRevoke={revokeWorkstation}
          onDelete={deleteWorkstation}
        />
      </section>

      {/* Open Issues Section */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Open issues</p>
            <h3>Alerts requiring attention</h3>
          </div>
        </div>
        {matchedAlerts.length ? (
          <>
            <Pagination
              totalItems={matchedAlerts.length}
              pageSize={alertPageSize}
              currentPage={safeAlertPage}
              onPageChange={setAlertPage}
              scope="alerts"
            />
            <div className="issue-list">
              {paginatedAlerts.map((item) => (
                <article key={item.id} className="issue-item">
                  <div className="issue-heading">
                    <strong>{item.kind}</strong>
                    <Badge
                      status={item.kind === "offline" ? "Offline" : "Unknown"}
                    />
                  </div>
                  <p>
                    {item.workstationId} · {item.createdAt}
                  </p>
                  <small>{item.message}</small>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>No records to display</h3>
            <p>No unresolved agent alerts have been reported.</p>
          </div>
        )}
      </section>
    </div>
  );
}
