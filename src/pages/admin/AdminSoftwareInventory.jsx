import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import Badge from "../../components/common/Badge.jsx";
import { StructuredFields } from "../../components/common/StructuredDetails.jsx";
import { formatDate } from "../../utils/helpers.js";

export default function AdminSoftwareInventory({ workstations = [] }) {
  const { adminSearch, setAdminSearch } = useApp();
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  const query = adminSearch.trim().toLowerCase();

  const records = workstations.flatMap((station) =>
    (station.software || [])
      .filter((item) => {
        if (!query) return true;
        const sMatch = `${item.name} ${item.version} ${item.publisher} ${item.source}`
          .toLowerCase()
          .includes(query);
        const wMatch = `${station.id} ${station.lab}`
          .toLowerCase()
          .includes(query);
        return sMatch || wMatch;
      })
      .map((item) => ({
        ...item,
        workstation: station.id,
        lab: station.lab,
        freshness: station.inventoryFreshness,
        lastScan: station.lastInventoryScan
      }))
  );

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = records.slice(
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
          <p className="eyebrow">Agent-detected applications</p>
          <h2>Software inventory</h2>
        </div>
        <span className="demo-tag">{records.length} detected records</span>
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
        placeholder="Search application, publisher, workstation, or lab"
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

      {records.length ? (
        <>
          <Pagination
            totalItems={records.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="software records"
          />

          <div className="inventory-list">
            {paginated.map((item, idx) => (
              <article
                key={idx}
                className="inventory-item structured-inventory-item"
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.version || "Version not reported"} ·{" "}
                    {item.workstation}
                  </span>
                </div>
                <div>
                  <Badge
                    status={
                      item.freshness === "Fresh" ? "Available" : "Unknown"
                    }
                  />
                </div>
                <details className="structured-details">
                  <summary>Record details</summary>
                  <StructuredFields
                    fields={[
                      ["Version", item.version || "Not reported"],
                      ["Publisher", item.publisher || "Not reported"],
                      ["Workstation", item.workstation],
                      ["Laboratory", item.lab],
                      ["Inventory freshness", item.freshness],
                      ["Last scan", formatDate(item.lastScan)],
                      ["Last detected", formatDate(item.detected_at)],
                      ["Detection source", item.source || "Not reported"]
                    ]}
                  />
                </details>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No software records match the selected filters.</p>
        </div>
      )}
    </section>
  );
}
