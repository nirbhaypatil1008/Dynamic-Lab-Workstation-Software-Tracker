import React, { useState } from "react";
import Badge from "../common/Badge.jsx";
import Pagination from "../common/Pagination.jsx";
import { StructuredWorkstationDetails } from "../common/StructuredDetails.jsx";
import { formatDate } from "../../utils/helpers.js";

export default function AdminWorkstationTable({
  workstations = [],
  onOpenWorkstation,
  onReconnect,
  onToggleMaintenance,
  onRevoke,
  onDelete
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  if (!workstations.length) {
    return (
      <div className="empty-state">
        <h3>No records to display</h3>
        <p>
          Register a workstation and install its authorized monitoring agent to
          begin receiving data.
        </p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(workstations.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginatedItems = workstations.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  return (
    <>
      <Pagination
        totalItems={workstations.length}
        pageSize={pageSize}
        currentPage={safePage}
        onPageChange={setCurrentPage}
        scope="workstations"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Workstation</th>
              <th>Laboratory</th>
              <th>Status</th>
              <th>IP Address</th>
              <th>OS</th>
              <th>Heartbeat</th>
              <th>Inventory Scan</th>
              <th>Health</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => {
              const isRevoked = item.revoked || item.status === "Revoked";
              return (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="table-link"
                      onClick={() => onOpenWorkstation(item.id)}
                    >
                      {item.id}
                    </button>
                    <span className="table-room">
                      {item.hostname || "Hostname not reported"}
                    </span>
                    <StructuredWorkstationDetails item={item} />
                  </td>
                  <td>
                    {item.lab}
                    <span className="table-room">
                      {item.room || "Room not reported"}
                    </span>
                  </td>
                  <td>
                    {isRevoked ? (
                      <span className="badge danger">Revoked</span>
                    ) : (
                      <Badge status={item.status} />
                    )}
                  </td>
                  <td>
                    <strong>{item.ipAddress || "Not reported"}</strong>
                    <span className="table-room">
                      v{item.agentVersion || "1.0.0"}
                    </span>
                  </td>
                  <td>{item.os || "Not available"}</td>
                  <td>{formatDate(item.lastHeartbeat)}</td>
                  <td>
                    {formatDate(item.lastInventoryScan)}
                    <span className="table-room">
                      {item.inventoryFreshness}
                    </span>
                  </td>
                  <td>
                    {item.health?.cpuPercent == null
                      ? "Not available"
                      : `${item.health.cpuPercent}% CPU`}
                    <span className="table-room">
                      {item.health?.network || "Not available"} network
                    </span>
                  </td>
                  <td className="table-actions">
                    {isRevoked ? (
                      <>
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() => onReconnect(item.id)}
                          title="Generate a one-command PowerShell installer to re-enroll this PC"
                        >
                          Re-enroll
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button delete-pc-btn"
                          onClick={() => onDelete(item.id)}
                          title="Permanently delete this registered workstation"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => onReconnect(item.id)}
                          title="Generate a one-command PowerShell installer to reconnect this PC"
                        >
                          Reconnect
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() =>
                            onToggleMaintenance(
                              item.id,
                              item.status === "Maintenance"
                            )
                          }
                        >
                          {item.status === "Maintenance"
                            ? "Restore"
                            : "Maintenance"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button danger-button-text"
                          onClick={() => onRevoke(item.id)}
                          title="Revoke agent token immediately"
                        >
                          Revoke
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button delete-pc-btn"
                          onClick={() => onDelete(item.id)}
                          title="Permanently delete this registered workstation"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
