import React from "react";
import { useApp } from "../context/AppContext.jsx";
import Icon from "../components/common/Icon.jsx";
import Badge from "../components/common/Badge.jsx";
import LabIllustration from "../components/common/LabIllustration.jsx";
import WorkstationIllustration from "../components/common/WorkstationIllustration.jsx";
import {
  statusClass,
  categorizeSoftware
} from "../utils/helpers.js";

export default function Laboratories({ workstations = [], labs = [] }) {
  const {
    selectedLabName,
    setSelectedLabName,
    labSearch,
    setLabSearch,
    openWorkstation,
    favorites,
    toggleFavorite
  } = useApp();

  // If a specific lab is selected:
  if (selectedLabName) {
    const labName = selectedLabName;
    const lab = labs.find((l) => l.name === labName) || {
      name: labName,
      room: "Assigned Lab"
    };
    const labStations = workstations.filter((w) => w.lab === labName);
    const availableCount = labStations.filter((w) => w.status === "Available")
      .length;
    const inUseCount = labStations.filter((w) => w.status === "In use").length;
    const offlineCount = labStations.filter((w) => w.status === "Offline")
      .length;
    const pct = labStations.length
      ? Math.round((availableCount / labStations.length) * 100)
      : 0;
    const osList = [...new Set(labStations.map((w) => w.os).filter(Boolean))];

    // Collect software detected across this lab
    const labSoftware = new Map();
    for (const ws of labStations) {
      for (const item of ws.software || []) {
        if (!item.name) continue;
        labSoftware.set(item.name, (labSoftware.get(item.name) || 0) + 1);
      }
    }
    const topLabSoftware = [...labSoftware.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    return (
      <div className="lab-detail-view">
        <button
          type="button"
          className="lab-breadcrumb-btn"
          onClick={() => setSelectedLabName("")}
        >
          <Icon name="ArrowRight" /> Back to All Laboratories
        </button>

        <section className="lab-detail-hero">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div>
              <p className="eyebrow">Laboratory Facility Details</p>
              <h2 style={{ fontSize: "1.8rem", margin: "4px 0 6px 0" }}>
                {lab.name}
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Room: <strong>{lab.room || "Room not reported"}</strong> ·
                Registered Campus Computer Laboratory
              </p>
            </div>
            <Badge
              status={
                availableCount > 0
                  ? "Available"
                  : labStations.length === 0
                  ? "Unknown"
                  : "In use"
              }
            />
          </div>

          <div className="lab-detail-stats-grid">
            <div className="metric-box light">
              <span>Total Workstations</span>
              <strong>{labStations.length}</strong>
            </div>
            <div className="metric-box light">
              <span>Available Now</span>
              <strong style={{ color: "var(--color-available)" }}>
                {availableCount}
              </strong>
            </div>
            <div className="metric-box light">
              <span>In Use</span>
              <strong style={{ color: "var(--color-occupied)" }}>
                {inUseCount}
              </strong>
            </div>
            <div className="metric-box light">
              <span>Offline</span>
              <strong style={{ color: "var(--color-offline)" }}>
                {offlineCount}
              </strong>
            </div>
          </div>

          {/* Capacity Track */}
          <div className="lab-capacity-bar-wrap" style={{ marginTop: "16px" }}>
            <div className="lab-capacity-label">
              <span>Facility Capacity Readiness</span>
              <strong>
                {availableCount} of {labStations.length} Ready ({pct}%)
              </strong>
            </div>
            <div className="lab-capacity-track">
              <div
                className="lab-capacity-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {osList.length > 0 && (
            <div
              style={{
                marginTop: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap"
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  fontWeight: 600
                }}
              >
                Operating Systems:
              </span>
              {osList.map((os) => (
                <span key={os} className="chip soft">
                  {os}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Top Software in this Lab */}
        <section className="panel" style={{ marginBottom: "20px" }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Laboratory Inventory</p>
              <h3>Top Detected Software in {lab.name}</h3>
            </div>
            <span className="demo-tag">{labSoftware.size} Packages</span>
          </div>
          {topLabSoftware.length ? (
            <div className="software-catalog-grid">
              {topLabSoftware.map(([name, count]) => (
                <div key={name} className="software-catalog-tag">
                  <span className="software-tag-name">{name}</span>
                  <span className="software-count-chip">
                    {count} {count === 1 ? "PC" : "PCs"}
                  </span>
                  <span className="software-cat-badge">
                    {categorizeSoftware(name)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No records to display</h3>
              <p>No software scans reported for this laboratory yet.</p>
            </div>
          )}
        </section>

        {/* Workstations Assigned to this Lab */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Hardware Allocation</p>
              <h3>Workstations Assigned to this Facility ({labStations.length})</h3>
            </div>
          </div>
          {labStations.length ? (
            <div className="airbnb-listings-grid" style={{ marginTop: "16px" }}>
              {labStations.map((w) => {
                const isFavorited = favorites.has(w.id);
                const softList = w.software || [];
                const topSoft = softList.slice(0, 3);
                return (
                  <article key={w.id} className="airbnb-listing-card">
                    <div
                      className="listing-visual-wrap"
                      onClick={() => openWorkstation(w.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <WorkstationIllustration ws={w} />
                      <div className="listing-badge-overlay">
                        <span
                          className={`listing-status-badge ${statusClass(
                            w.status
                          )}`}
                        >
                          {w.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`listing-favorite-btn ${
                          isFavorited ? "active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(w.id);
                        }}
                      >
                        <Icon name={isFavorited ? "HeartFilled" : "Heart"} />
                      </button>
                    </div>
                    <div className="listing-content">
                      <div className="listing-header-row">
                        <div
                          className="listing-title-group"
                          onClick={() => openWorkstation(w.id)}
                        >
                          <h3 className="listing-title">{w.id}</h3>
                          <span className="listing-hostname">
                            {w.hostname || "Workstation"}
                          </span>
                        </div>
                        <span className="listing-os-pill">
                          {w.os ? w.os.split(" ")[0] : "OS"}
                        </span>
                      </div>
                      <div className="listing-software-chips">
                        {topSoft.map((s, idx) => (
                          <span key={idx} className="listing-soft-chip">
                            {s.name}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="listing-action-btn"
                        onClick={() => openWorkstation(w.id)}
                      >
                        View Details <Icon name="ArrowRight" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No records to display</h3>
              <p>No workstations currently assigned to this laboratory.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  // All Labs Directory Grid (Airbnb Destinations Style)
  const query = labSearch.trim().toLowerCase();
  const filteredLabs = labs.filter((l) => {
    if (!query) return true;
    return (
      l.name.toLowerCase().includes(query) ||
      (l.room || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="laboratories-view">
      {/* Search Lab Bar */}
      <section
        className="find-filter-panel"
        style={{ marginBottom: "24px" }}
      >
        <form
          id="lab-search-form"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap"
          }}
          onSubmit={(e) => e.preventDefault()}
        >
          <label
            className="field search-field"
            style={{ flex: 1, minWidth: "240px", margin: 0 }}
          >
            <span>Search Laboratory or Room</span>
            <div className="input-shell">
              <Icon name="Search" />
              <input
                name="labSearch"
                type="search"
                value={labSearch}
                onChange={(e) => setLabSearch(e.target.value)}
                placeholder="Search by lab name, department, or room number..."
                aria-label="Search laboratories"
              />
            </div>
          </label>
          {labSearch && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setLabSearch("")}
            >
              Clear
            </button>
          )}
        </form>
      </section>

      {/* Laboratories Destinations Grid */}
      {filteredLabs.length ? (
        <div className="airbnb-destinations-grid">
          {filteredLabs.map((l) => {
            const labStations = workstations.filter((w) => w.lab === l.name);
            const labAvail = labStations.filter(
              (w) => w.status === "Available"
            ).length;
            const pct = labStations.length
              ? Math.round((labAvail / labStations.length) * 100)
              : 0;
            return (
              <article
                key={l.name}
                className="airbnb-destination-card"
                onClick={() => setSelectedLabName(l.name)}
              >
                <div className="destination-visual-wrap">
                  <LabIllustration labName={l.name} />
                  <span className="destination-room-pill">
                    {l.room || "Room not reported"}
                  </span>
                </div>
                <div className="destination-info">
                  <h3 className="destination-name">{l.name}</h3>
                  <div className="destination-meta-row">
                    <span>
                      <strong>{labStations.length}</strong> total PCs
                    </span>
                    <span>·</span>
                    <span className="text-available">
                      <strong>{labAvail}</strong> ready ({pct}%)
                    </span>
                  </div>
                  <div className="destination-capacity-bar">
                    <div
                      className="destination-capacity-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    className="destination-explore-btn"
                    onClick={() => setSelectedLabName(l.name)}
                  >
                    Explore Lab Inventory <Icon name="ArrowRight" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No laboratories match your search query. Try another keyword.</p>
        </div>
      )}
    </div>
  );
}
