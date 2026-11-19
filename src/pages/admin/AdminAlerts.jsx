import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import Badge from "../../components/common/Badge.jsx";

export default function AdminAlerts({ alerts = [] }) {
  const { adminSearch, setAdminSearch } = useApp();
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  const query = adminSearch.trim().toLowerCase();
  const unresolvedAlerts = alerts.filter((item) => !item.resolvedAt);
  const matched = unresolvedAlerts.filter(
    (item) =>
      !query ||
      `${item.kind} ${item.message} ${item.workstationId}`
        .toLowerCase()
        .includes(query)
  );

  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = matched.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agent and operations alerts</p>
          <h2>Alerts</h2>
        </div>
      </div>

      <AdminSearchForm
        search={adminSearch}
        onSearchChange={(v) => {
          setAdminSearch(v);
          setCurrentPage(0);
        }}
        onClear={() => {
          setAdminSearch("");
          setCurrentPage(0);
        }}
        placeholder="Search alerts"
      />

      {matched.length ? (
        <>
          <Pagination
            totalItems={matched.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="alerts"
          />

          <div className="issue-list">
            {paginated.map((item) => (
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
          <p>No unresolved alerts match the selected search.</p>
        </div>
      )}
    </section>
  );
}
