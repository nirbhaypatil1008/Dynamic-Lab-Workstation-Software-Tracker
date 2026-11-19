import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import Icon from "../components/common/Icon.jsx";
import Badge from "../components/common/Badge.jsx";
import Pagination from "../components/common/Pagination.jsx";
import WorkstationIllustration from "../components/common/WorkstationIllustration.jsx";
import {
  statusClass,
  formatBytes,
  timeAgo
} from "../utils/helpers.js";

export default function FindWorkstations({ workstations = [], labs = [] }) {
  const {
    search,
    setSearch,
    lab,
    setLab,
    os,
    setOs,
    availability,
    setAvailability,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    favorites,
    toggleFavorite,
    openWorkstation
  } = useApp();

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 12;

  const osList = [...new Set(workstations.map((w) => w.os).filter(Boolean))];
  const query = search.trim().toLowerCase();

  // Filter workstations
  const filtered = workstations.filter((w) => {
    const matchesLab = !lab || w.lab === lab;
    const matchesOs = !os || w.os === os;
    const matchesAvail = !availability || w.status === availability;
    let matchesQuery = true;
    if (query) {
      const idMatch = w.id.toLowerCase().includes(query);
      const hostMatch = (w.hostname || "").toLowerCase().includes(query);
      const roomMatch = (w.room || "").toLowerCase().includes(query);
      const softMatch = (w.software || []).some((s) =>
        `${s.name} ${s.version} ${s.publisher}`.toLowerCase().includes(query)
      );
      matchesQuery = idMatch || hostMatch || roomMatch || softMatch;
    }
    return matchesLab && matchesOs && matchesAvail && matchesQuery;
  });

  // Sort workstations
  filtered.sort((a, b) => {
    if (sortBy === "id-desc") return b.id.localeCompare(a.id);
    if (sortBy === "status") {
      const order = {
        Available: 1,
        "In use": 2,
        Idle: 3,
        Maintenance: 4,
        Offline: 5,
        Unknown: 6
      };
      return (order[a.status] || 99) - (order[b.status] || 99);
    }
    if (sortBy === "recent") {
      return (
        Date.parse(b.lastHeartbeat || b.lastInventoryScan || 0) -
        Date.parse(a.lastHeartbeat || a.lastInventoryScan || 0)
      );
    }
    if (sortBy === "cpu") {
      return (a.health?.cpuPercent ?? 100) - (b.health?.cpuPercent ?? 100);
    }
    return a.id.localeCompare(b.id);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = filtered.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  function handleReset() {
    setSearch("");
    setLab("");
    setOs("");
    setAvailability("");
    setSortBy("id-asc");
    setCurrentPage(0);
  }

  return (
    <div className="find-workstation-view">
      {/* Search & Filters Panel (Airbnb Search Page Pattern) */}
      <section className="find-filter-panel">
        <form id="student-search-form" onSubmit={(e) => e.preventDefault()}>
          <div className="filter-controls-row">
            <label className="field" style={{ margin: 0 }}>
              <span>Search Computer or Software</span>
              <div className="input-shell">
                <Icon name="Search" />
                <input
                  name="software"
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(0);
                  }}
                  placeholder="Search ID, hostname, Python, MongoDB, VS Code..."
                  aria-label="Search computer or software"
                />
              </div>
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span>Laboratory</span>
              <select
                name="lab"
                value={lab}
                onChange={(e) => {
                  setLab(e.target.value);
                  setCurrentPage(0);
                }}
              >
                <option value="">All Laboratories</option>
                {labs.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span>Operating System</span>
              <select
                name="os"
                value={os}
                onChange={(e) => {
                  setOs(e.target.value);
                  setCurrentPage(0);
                }}
              >
                <option value="">All Operating Systems</option>
                {osList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span>Status</span>
              <select
                name="availability"
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value);
                  setCurrentPage(0);
                }}
              >
                <option value="">All Statuses</option>
                {[
                  "Available",
                  "In use",
                  "Idle",
                  "Offline",
                  "Maintenance",
                  "Unknown"
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span>Sort By</span>
              <select
                name="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="id-asc">ID (A to Z)</option>
                <option value="id-desc">ID (Z to A)</option>
                <option value="status">Available First</option>
                <option value="recent">Most Recently Active</option>
                <option value="cpu">Lowest CPU Usage</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </form>

        {/* Active Filter Pills & View Toggles */}
        <div className="filter-pills-bar">
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              fontWeight: 600
            }}
          >
            Active Filters:
          </span>
          {!search && !lab && !os && !availability ? (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              None (Showing all workstations)
            </span>
          ) : null}

          {search && (
            <span className="filter-chip-removable">
              Search: "<strong>{search}</strong>"
              <button
                type="button"
                className="filter-chip-remove-btn"
                onClick={() => setSearch("")}
                aria-label="Remove search filter"
              >
                ✕
              </button>
            </span>
          )}

          {lab && (
            <span className="filter-chip-removable">
              Lab: <strong>{lab}</strong>
              <button
                type="button"
                className="filter-chip-remove-btn"
                onClick={() => setLab("")}
                aria-label="Remove lab filter"
              >
                ✕
              </button>
            </span>
          )}

          {os && (
            <span className="filter-chip-removable">
              OS: <strong>{os}</strong>
              <button
                type="button"
                className="filter-chip-remove-btn"
                onClick={() => setOs("")}
                aria-label="Remove OS filter"
              >
                ✕
              </button>
            </span>
          )}

          {availability && (
            <span className="filter-chip-removable">
              Status: <strong>{availability}</strong>
              <button
                type="button"
                className="filter-chip-remove-btn"
                onClick={() => setAvailability("")}
                aria-label="Remove status filter"
              >
                ✕
              </button>
            </span>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Showing {filtered.length} computer
              {filtered.length === 1 ? "" : "s"}
            </span>
            <div className="view-toggle-wrap">
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === "grid" ? "active" : ""
                }`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Icon name="Grid" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === "table" ? "active" : ""
                }`}
                onClick={() => setViewMode("table")}
                aria-label="Table view"
              >
                <Icon name="List" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Workstations Presentation */}
      {filtered.length ? (
        <>
          <Pagination
            totalItems={filtered.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="workstations"
          />

          {viewMode === "grid" ? (
            <div className="airbnb-listings-grid">
              {paginated.map((w) => {
                const isFavorited = favorites.has(w.id);
                const softList = w.software || [];
                const topSoft = softList.slice(0, 3);
                const remainingCount = softList.length - 3;
                return (
                  <article key={w.id} className="airbnb-listing-card">
                    {/* Visual Cover Area */}
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
                          <span className="status-pulse-dot" />
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
                        aria-label={
                          isFavorited
                            ? "Remove from saved"
                            : "Save workstation"
                        }
                      >
                        <Icon name={isFavorited ? "HeartFilled" : "Heart"} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="listing-content">
                      <div className="listing-header-row">
                        <div
                          className="listing-title-group"
                          onClick={() => openWorkstation(w.id)}
                          style={{ cursor: "pointer" }}
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

                      <p className="listing-location">
                        <Icon name="Laboratories" />
                        <span>
                          {w.lab} · {w.room || "Room not reported"}
                        </span>
                      </p>

                      <div className="listing-software-chips">
                        {topSoft.length ? (
                          topSoft.map((s, idx) => (
                            <span key={idx} className="listing-soft-chip">
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span className="listing-soft-chip muted">
                            Standard OS
                          </span>
                        )}
                        {remainingCount > 0 && (
                          <span className="listing-soft-chip more">
                            +{remainingCount} more
                          </span>
                        )}
                      </div>

                      <div className="listing-footer-row">
                        <div className="listing-telemetry">
                          <span>RAM: {formatBytes(w.memoryTotalBytes)}</span>
                          <span>
                            · CPU:{" "}
                            {w.health?.cpuPercent == null
                              ? "N/A"
                              : `${w.health.cpuPercent}%`}
                          </span>
                        </div>
                        <span className="listing-time">
                          {timeAgo(w.lastHeartbeat || w.lastInventoryScan)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="listing-action-btn"
                        onClick={() => openWorkstation(w.id)}
                      >
                        View System Details <Icon name="ArrowRight" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Workstation</th>
                    <th>Laboratory</th>
                    <th>Status</th>
                    <th>OS & CPU</th>
                    <th>RAM / Disk</th>
                    <th>Health</th>
                    <th>Software</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => openWorkstation(w.id)}
                        >
                          {w.id}
                        </button>
                        <span className="table-room">
                          {w.hostname || "Workstation"}
                        </span>
                      </td>
                      <td>
                        {w.lab}
                        <span className="table-room">
                          {w.room || "Room not reported"}
                        </span>
                      </td>
                      <td>
                        <Badge status={w.status} />
                      </td>
                      <td>
                        <div>{w.os || "Not reported"}</div>
                        <span
                          className="table-room"
                          style={{
                            maxWidth: "180px",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {w.cpu || "Not reported"}
                        </span>
                      </td>
                      <td>
                        <div>{formatBytes(w.memoryTotalBytes)}</div>
                        <span className="table-room">
                          {formatBytes(w.diskTotalBytes)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem" }}>
                          CPU:{" "}
                          {w.health?.cpuPercent == null
                            ? "N/A"
                            : `${w.health.cpuPercent}%`}
                        </span>
                      </td>
                      <td>
                        <span className="chip soft">
                          {w.software?.length || 0} packages
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => openWorkstation(w.id)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>
            No workstations match your search or filter criteria. Try clearing
            filters.
          </p>
        </div>
      )}
    </div>
  );
}
