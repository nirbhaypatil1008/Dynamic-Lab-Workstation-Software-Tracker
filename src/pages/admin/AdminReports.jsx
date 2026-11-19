import React, { useState } from "react";
import Pagination from "../../components/common/Pagination.jsx";

export default function AdminReports({ workstations = [] }) {
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  const labs = [...new Set(workstations.map((item) => item.lab))];
  const pageCount = Math.max(1, Math.ceil(labs.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginatedLabs = labs.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Current snapshot</p>
          <h2>Operational report</h2>
        </div>
      </div>
      <p className="data-note">
        Historical utilization is unavailable because the system has not yet
        recorded historical usage. This report contains current workstation and
        laboratory totals only.
      </p>

      {labs.length ? (
        <>
          <Pagination
            totalItems={labs.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="laboratories"
          />

          <div className="utilization-list">
            {paginatedLabs.map((lab) => {
              const entries = workstations.filter((item) => item.lab === lab);
              const available = entries.filter(
                (item) => item.status === "Available"
              ).length;
              return (
                <div key={lab} className="lab-row">
                  <strong>{lab}</strong>
                  <span>
                    {available} available of {entries.length} registered
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No registered laboratory data is available.</p>
        </div>
      )}
    </section>
  );
}
