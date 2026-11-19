import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import Badge from "../../components/common/Badge.jsx";
import { StructuredWorkstationDetails } from "../../components/common/StructuredDetails.jsx";
import { formatDate } from "../../utils/helpers.js";

export default function AdminSystemHealth({ workstations = [] }) {
  const {
    adminSearch,
    setAdminSearch,
    adminStatus,
    setAdminStatus,
    openWorkstation
  } = useApp();

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  const query = adminSearch.trim().toLowerCase();
  const filtered = workstations.filter((item) => {
    const matchesStatus = !adminStatus || item.status === adminStatus;
    const searchable = [
      item.id,
      item.hostname,
      item.lab,
      item.room,
      item.os
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!query || searchable.includes(query));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = filtered.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  function handleToggleDetails(expand) {
    document
      .querySelectorAll("#page-content details")
      .forEach((d) => (d.open = expand));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Latest telemetry only</p>
          <h2>System health</h2>
        </div>
      </div>

      <AdminSearchForm
        search={adminSearch}
        status={adminStatus}
        onSearchChange={(v) => {
          setAdminSearch(v);
          setCurrentPage(0);
        }}
        onStatusChange={(v) => {
          setAdminStatus(v);
          setCurrentPage(0);
        }}
        onClear={() => {
          setAdminSearch("");
          setAdminStatus("");
          setCurrentPage(0);
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

      {filtered.length ? (
        <>
          <Pagination
            totalItems={filtered.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="health records"
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>Disk</th>
                  <th>Network</th>
                  <th>Metric timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() => openWorkstation(item.id)}
                      >
                        {item.id}
                      </button>
                      <span className="table-room">{item.lab}</span>
                      <StructuredWorkstationDetails item={item} />
                    </td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td>
                      {item.health?.cpuPercent == null
                        ? "Not available"
                        : `${item.health.cpuPercent}%`}
                    </td>
                    <td>
                      {item.health?.memoryPercent == null
                        ? "Not available"
                        : `${item.health.memoryPercent}%`}
                    </td>
                    <td>
                      {item.health?.diskPercent == null
                        ? "Not available"
                        : `${item.health.diskPercent}%`}
                    </td>
                    <td>{item.health?.network || "Not available"}</td>
                    <td>{formatDate(item.health?.reportedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No workstation health records match the selected filters.</p>
        </div>
      )}
    </section>
  );
}
