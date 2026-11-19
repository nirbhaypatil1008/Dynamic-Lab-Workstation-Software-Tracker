import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import Badge from "../../components/common/Badge.jsx";
import { StructuredWorkstationDetails } from "../../components/common/StructuredDetails.jsx";

export default function AdminMaintenance({ workstations = [] }) {
  const { toggleMaintenance } = useApp();
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  const affected = workstations.filter((item) => item.status === "Maintenance");
  const pageCount = Math.max(1, Math.ceil(affected.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = affected.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Authorized administrative action</p>
          <h2>Maintenance workstations</h2>
        </div>
      </div>

      {affected.length ? (
        <>
          <Pagination
            totalItems={affected.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="maintenance records"
          />

          <div className="issue-list">
            {paginated.map((item) => (
              <article key={item.id} className="issue-item">
                <div className="issue-heading">
                  <strong>
                    {item.id} · {item.lab}
                  </strong>
                  <Badge status={item.status} />
                </div>
                <p>
                  {item.maintenanceNote ||
                    "Maintenance state was set by an administrator."}
                </p>
                <StructuredWorkstationDetails item={item} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => toggleMaintenance(item.id, true)}
                >
                  Restore workstation
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No workstations are currently marked for maintenance.</p>
        </div>
      )}
    </section>
  );
}
