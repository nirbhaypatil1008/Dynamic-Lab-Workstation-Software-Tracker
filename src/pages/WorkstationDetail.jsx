import React from "react";
import { useApp } from "../context/AppContext.jsx";
import Icon from "../components/common/Icon.jsx";
import Badge from "../components/common/Badge.jsx";
import { StructuredFields } from "../components/common/StructuredDetails.jsx";
import {
  formatBytes,
  formatDate
} from "../utils/helpers.js";

export default function WorkstationDetail({ workstation, allWorkstations = [] }) {
  const {
    user,
    returnPage,
    backToWorkstations,
    openWorkstation,
    workstationSoftwareSearch,
    setWorkstationSoftwareSearch,
    reconnectWorkstation,
    revokeWorkstation,
    deleteWorkstation
  } = useApp();

  if (!workstation) {
    return (
      <div className="empty-state">
        <h3>This workstation was not found.</h3>
        <p>Return to the workstation list and choose another.</p>
        <button
          type="button"
          className="primary-button"
          onClick={backToWorkstations}
        >
          Back to workstations
        </button>
      </div>
    );
  }

  const search = workstationSoftwareSearch.trim().toLowerCase();
  const software = (workstation.software || []).filter((program) =>
    !search ||
    `${program.name} ${program.version} ${program.publisher} ${program.source}`
      .toLowerCase()
      .includes(search)
  );

  const otherMatches = search
    ? allWorkstations.filter(
        (system) =>
          system.id !== workstation.id &&
          system.inventoryFreshness === "Fresh" &&
          (system.software || []).some((program) =>
            `${program.name} ${program.version} ${program.publisher}`
              .toLowerCase()
              .includes(search)
          )
      )
    : [];

  const isRevoked = workstation.revoked || workstation.status === "Revoked";
  const isAdmin = user?.role === "admin";

  return (
    <div className="workstation-detail-page">
      <button
        type="button"
        className="back-link"
        onClick={backToWorkstations}
      >
        ← Back to {returnPage}
      </button>

      <section className="panel workstation-hero">
        <div className="workstation-hero-heading">
          <div>
            <p className="eyebrow">Full system record · {workstation.lab}</p>
            <h2>{workstation.id}</h2>
            <p className="muted-copy">
              {workstation.hostname || "Hostname not reported"} ·{" "}
              {workstation.room || "Room not reported"}
            </p>
          </div>
          <div className="hero-status-group">
            {isRevoked ? (
              <span className="badge danger">Revoked</span>
            ) : (
              <Badge status={workstation.status} />
            )}
            {isAdmin && (
              <div className="hero-admin-actions">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => reconnectWorkstation(workstation.id)}
                  title="Generate 1-command installer"
                >
                  ⚡ Reconnect
                </button>
                {!isRevoked && (
                  <button
                    type="button"
                    className="secondary-button compact-button danger-button-text"
                    onClick={() => revokeWorkstation(workstation.id)}
                  >
                    Revoke Access
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button compact-button delete-pc-btn"
                  onClick={() => deleteWorkstation(workstation.id)}
                  title="Permanently delete this registered workstation"
                >
                  Delete Workstation
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="data-note">
          {workstation.inventoryFreshness === "Fresh"
            ? "Inventory is recently reported by the authorized agent."
            : "The inventory is stale or missing. Treat this software list as last reported information, not confirmation of current installation."}
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Structured system information</p>
            <h3>Workstation details</h3>
          </div>
        </div>
        <div className="system-detail-sections">
          <section>
            <h4>Identification and assignment</h4>
            <StructuredFields
              fields={[
                ["Workstation ID", workstation.id],
                ["Hostname", workstation.hostname],
                ["Laboratory", workstation.lab],
                ["Room", workstation.room],
                ["Status", workstation.status],
                ["IP Address", workstation.ipAddress || "Not reported"],
                ["Agent Version", workstation.agentVersion || "1.0.0"]
              ]}
            />
          </section>
          <section>
            <h4>Operating system and hardware</h4>
            <StructuredFields
              fields={[
                ["Operating system", workstation.os],
                ["Processor", workstation.cpu],
                ["Memory capacity", formatBytes(workstation.memoryTotalBytes)],
                ["Disk capacity", formatBytes(workstation.diskTotalBytes)]
              ]}
            />
          </section>
          <section>
            <h4>Connectivity and inventory freshness</h4>
            <StructuredFields
              fields={[
                ["Last heartbeat", formatDate(workstation.lastHeartbeat)],
                [
                  "Last successful inventory scan",
                  formatDate(workstation.lastInventoryScan)
                ],
                ["Inventory freshness", workstation.inventoryFreshness],
                ["Network connectivity", workstation.health?.network],
                ["Metrics last reported", formatDate(workstation.health?.reportedAt)]
              ]}
            />
          </section>
          <section>
            <h4>Latest resource metrics</h4>
            <StructuredFields
              fields={[
                [
                  "CPU usage",
                  workstation.health?.cpuPercent == null
                    ? "Not available"
                    : `${workstation.health.cpuPercent}%`
                ],
                [
                  "Memory usage",
                  workstation.health?.memoryPercent == null
                    ? "Not available"
                    : `${workstation.health.memoryPercent}%`
                ],
                [
                  "Disk usage",
                  workstation.health?.diskPercent == null
                    ? "Not available"
                    : `${workstation.health.diskPercent}%`
                ]
              ]}
            />
          </section>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search detected applications</p>
            <h3>Software on {workstation.id}</h3>
          </div>
          <span className="demo-tag">
            {software.length} match{software.length === 1 ? "" : "es"}
          </span>
        </div>

        <form
          id="workstation-software-search"
          className="workstation-software-search"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="field">
            <span>Find required software on this system</span>
            <div className="input-shell">
              <Icon name="Find a Workstation" />
              <input
                type="search"
                name="softwareSearch"
                value={workstationSoftwareSearch}
                onChange={(e) => setWorkstationSoftwareSearch(e.target.value)}
                placeholder="Search Python, MongoDB, Java..."
                aria-label="Search software on this workstation"
              />
            </div>
          </label>
          {workstationSoftwareSearch && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setWorkstationSoftwareSearch("")}
            >
              Clear
            </button>
          )}
        </form>

        {software.length ? (
          <div className="system-software-list">
            {software.map((program, idx) => (
              <article key={idx} className="system-software-item">
                <div className="system-software-heading">
                  <div>
                    <h4>{program.name}</h4>
                    <span>{program.version || "Version not reported"}</span>
                  </div>
                  <span
                    className={`freshness ${
                      workstation.inventoryFreshness === "Fresh"
                        ? "fresh"
                        : "stale"
                    }`}
                  >
                    {workstation.inventoryFreshness} inventory
                  </span>
                </div>
                <StructuredFields
                  fields={[
                    ["Publisher", program.publisher || "Not reported"],
                    ["Detection source", program.source || "Not reported"],
                    ["Last detected", formatDate(program.detected_at)]
                  ]}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No records to display</h3>
            <p>
              {search
                ? `No reported application on ${workstation.id} matches “${workstationSoftwareSearch}”.`
                : "This workstation has no reported software inventory yet."}
            </p>
          </div>
        )}

        {search && (
          <section className="other-systems-results">
            <h4>Other systems with a fresh match</h4>
            {otherMatches.length ? (
              <ul>
                {otherMatches.map((system) => (
                  <li key={system.id}>
                    <Badge status={system.status} />
                    <span>
                      <strong>{system.id}</strong> · {system.lab}
                    </span>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => openWorkstation(system.id)}
                    >
                      View system
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">
                No other system has a fresh inventory match for this search.
              </p>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
