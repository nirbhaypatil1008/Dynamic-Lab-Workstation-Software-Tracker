import React from "react";
import { useApp } from "../context/AppContext.jsx";
import Icon from "../components/common/Icon.jsx";
import Badge from "../components/common/Badge.jsx";
import WorkstationIllustration from "../components/common/WorkstationIllustration.jsx";
import LabIllustration from "../components/common/LabIllustration.jsx";
import {
  discoveryCategoriesList
} from "../utils/constants.js";
import {
  statusClass,
  formatBytes,
  timeAgo,
  categorizeSoftware,
  matchesCategory
} from "../utils/helpers.js";

export default function StudentDashboard({ workstations = [], labs = [] }) {
  const {
    user,
    setPage,
    search,
    setSearch,
    lab,
    setLab,
    availability,
    setAvailability,
    activeCategory,
    setActiveCategory,
    favorites,
    toggleFavorite,
    openWorkstation,
    setSelectedLabName,
    apiLatency
  } = useApp();

  const total = workstations.length;
  const availableCount = workstations.filter((w) => w.status === "Available").length;
  const inUseCount = workstations.filter((w) => w.status === "In use").length;
  const idleCount = workstations.filter((w) => w.status === "Idle").length;
  const offlineCount = workstations.filter((w) => w.status === "Offline").length;

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
      ? "Good afternoon"
      : "Good evening";
  const studentName = user?.name ? user.name.split(" ")[0] : "Student";
  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  // Popular software detection count across campus
  const softwareMap = new Map();
  for (const ws of workstations) {
    const seenOnWs = new Set();
    for (const item of ws.software || []) {
      if (!item.name || seenOnWs.has(item.name)) continue;
      seenOnWs.add(item.name);
      softwareMap.set(item.name, (softwareMap.get(item.name) || 0) + 1);
    }
  }
  const topSoftware = [...softwareMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const categoryWorkstations = workstations.filter((w) =>
    matchesCategory(w, activeCategory)
  );

  const popularSuggestions = [
    "Python",
    "Java",
    "MongoDB",
    "Visual Studio Code",
    "Wireshark",
    "Docker",
    "Git",
    "Node.js",
    "C++",
    "PostgreSQL"
  ];

  const recentlyActive = [...workstations]
    .sort(
      (a, b) =>
        Date.parse(b.lastHeartbeat || b.lastInventoryScan || 0) -
        Date.parse(a.lastHeartbeat || a.lastInventoryScan || 0)
    )
    .slice(0, 5);

  function handleCapsuleSearch(e) {
    e.preventDefault();
    setPage("Find a Workstation");
  }

  function handleQuickNav(targetPage, filterStatus = "") {
    setPage(targetPage);
    if (filterStatus) {
      setAvailability(filterStatus);
    }
  }

  return (
    <div className="airbnb-explore-container">
      {/* A. Welcome Header */}
      <section className="airbnb-welcome-hero">
        <div className="welcome-hero-text">
          <div className="welcome-greeting-badge">
            <span className="live-pulse-dot" />
            <span>
              {greeting}, {studentName} · {todayFormatted}
            </span>
          </div>
          <h1 className="welcome-hero-title">Discover Your Next Workstation</h1>
          <p className="welcome-hero-subtitle">
            Find the right computer, software, and laboratory before you visit.
          </p>
        </div>
        <div className="welcome-hero-badges">
          <span className="hero-chip">
            <Icon name="Profile" /> USN: {user?.identifier || "Registered"}
          </span>
          <span className="hero-chip">
            <Icon name="Laboratories" /> Dept: {user?.department || "General"}
          </span>
          <span className="hero-chip api-status-chip">
            <span className="status-indicator-dot" />
            {apiLatency || 12}ms API Telemetry
          </span>
        </div>
      </section>

      {/* B. Floating Search Capsule (Airbnb 3-Segment Style) */}
      <section className="search-capsule-wrapper">
        <form
          id="airbnb-search-form"
          className="floating-search-capsule"
          role="search"
          onSubmit={handleCapsuleSearch}
        >
          {/* 1. Find Software */}
          <div className="capsule-segment" data-segment="software">
            <label htmlFor="capsule-software" className="capsule-label">
              Find Software
            </label>
            <input
              id="capsule-software"
              name="software"
              type="search"
              className="capsule-input"
              placeholder="Python, Java, MongoDB, VS Code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              list="capsule-software-datalist"
              autoComplete="off"
            />
            <datalist id="capsule-software-datalist">
              {popularSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="capsule-divider" />

          {/* 2. Choose Laboratory */}
          <div className="capsule-segment" data-segment="lab">
            <label htmlFor="capsule-lab" className="capsule-label">
              Choose Laboratory
            </label>
            <select
              id="capsule-lab"
              name="lab"
              className="capsule-select"
              value={lab}
              onChange={(e) => setLab(e.target.value)}
            >
              <option value="">All laboratories</option>
              {labs.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="capsule-divider" />

          {/* 3. Workstation Availability */}
          <div className="capsule-segment" data-segment="status">
            <label htmlFor="capsule-status" className="capsule-label">
              Availability
            </label>
            <select
              id="capsule-status"
              name="availability"
              className="capsule-select"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="">All workstations</option>
              <option value="Available">Available</option>
              <option value="In use">Occupied / In Use</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          {/* Search Action Button */}
          <button
            type="submit"
            className="capsule-search-btn"
            aria-label="Search workstations"
          >
            <Icon name="Search" />
            <span className="capsule-btn-text">Search</span>
          </button>
        </form>
      </section>

      {/* C. Horizontal Discovery Categories */}
      <section className="airbnb-categories-bar">
        <div className="categories-scroll-track" id="categories-track">
          {discoveryCategoriesList.map((cat) => (
            <button
              key={cat.name}
              type="button"
              className={`category-item-btn ${
                activeCategory === cat.name ? "active" : ""
              }`}
              onClick={() => setActiveCategory(cat.name)}
            >
              <span className="category-icon-wrap">
                <Icon name={cat.icon} />
              </span>
              <span className="category-title">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* D. Workstation Discovery Cards (Airbnb Listing Pattern) */}
      <section className="airbnb-listings-section">
        <div className="section-title-row">
          <div>
            <h2 className="airbnb-section-title">{activeCategory}</h2>
            <p className="airbnb-section-subtitle">
              Showing {categoryWorkstations.length} workstation
              {categoryWorkstations.length === 1 ? "" : "s"} ready for academic
              coursework
            </p>
          </div>
          <button
            type="button"
            className="airbnb-view-all-link"
            onClick={() => handleQuickNav("Find a Workstation")}
          >
            View all workstations <Icon name="ArrowRight" />
          </button>
        </div>

        {categoryWorkstations.length ? (
          <div className="airbnb-listings-grid">
            {categoryWorkstations.slice(0, 8).map((w) => {
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
                    aria-label={`View workstation ${w.id}`}
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

                  {/* Card Content */}
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

                    {/* Installed Software Chips */}
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

                    {/* Card Footer: Live Telemetry & Relative Reported Time */}
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
            <p>
              No workstations found under "{activeCategory}". Try selecting
              another category or view all.
            </p>
          </div>
        )}
      </section>

      {/* E. Live Availability Overview */}
      <section className="airbnb-availability-overview">
        <div
          className="availability-card-interactive"
          onClick={() => handleQuickNav("Find a Workstation")}
        >
          <div className="avail-card-header">
            <span className="avail-label">Total Workstations</span>
            <Icon name="Server" />
          </div>
          <div className="avail-number">{total}</div>
          <span className="avail-footer">Across {labs.length} laboratories</span>
        </div>

        <div
          className="availability-card-interactive highlight-available"
          onClick={() => handleQuickNav("Find a Workstation", "Available")}
        >
          <div className="avail-card-header">
            <span className="avail-label">Available Now</span>
            <Icon name="CheckCircle" />
          </div>
          <div className="avail-number text-available">{availableCount}</div>
          <span className="avail-footer">
            {total ? Math.round((availableCount / total) * 100) : 0}% of fleet ready
          </span>
        </div>

        <div
          className="availability-card-interactive highlight-occupied"
          onClick={() => handleQuickNav("Find a Workstation", "In use")}
        >
          <div className="avail-card-header">
            <span className="avail-label">Occupied / In Use</span>
            <Icon name="UserCheck" />
          </div>
          <div className="avail-number text-occupied">{inUseCount}</div>
          <span className="avail-footer">Active student sessions</span>
        </div>

        <div
          className="availability-card-interactive highlight-offline"
          onClick={() => handleQuickNav("Find a Workstation", "Offline")}
        >
          <div className="avail-card-header">
            <span className="avail-label">Offline / Standby</span>
            <Icon name="PowerOff" />
          </div>
          <div className="avail-number text-offline">
            {offlineCount + idleCount}
          </div>
          <span className="avail-footer">
            {offlineCount} offline, {idleCount} idle
          </span>
        </div>
      </section>

      {/* F. Explore Laboratories (Airbnb Destinations Layout) */}
      <section className="airbnb-destinations-section">
        <div className="section-title-row">
          <div>
            <h2 className="airbnb-section-title">Explore Laboratories</h2>
            <p className="airbnb-section-subtitle">
              Browse campus computing facilities, room numbers, and available
              hardware
            </p>
          </div>
          <button
            type="button"
            className="airbnb-view-all-link"
            onClick={() => handleQuickNav("Laboratories")}
          >
            All laboratories <Icon name="ArrowRight" />
          </button>
        </div>

        {labs.length ? (
          <div className="airbnb-destinations-grid">
            {labs.slice(0, 4).map((l) => {
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
                  onClick={() => {
                    setSelectedLabName(l.name);
                    setPage("Laboratories");
                  }}
                >
                  <div className="destination-visual-wrap">
                    <LabIllustration labName={l.name} />
                    <span className="destination-room-pill">
                      {l.room || "Lab Facility"}
                    </span>
                  </div>
                  <div className="destination-info">
                    <h3 className="destination-name">{l.name}</h3>
                    <div className="destination-meta-row">
                      <span>
                        <strong>{labStations.length}</strong> computers
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
                      onClick={() => {
                        setSelectedLabName(l.name);
                        setPage("Laboratories");
                      }}
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
            <p>No laboratories registered in the system yet.</p>
          </div>
        )}
      </section>

      {/* G. Popular Software Across Campus */}
      <section className="airbnb-software-section">
        <div className="section-title-row">
          <div>
            <h2 className="airbnb-section-title">
              Explore Software Across Your Campus
            </h2>
            <p className="airbnb-section-subtitle">
              Click any detected developer environment or package to find computers
              equipped with it
            </p>
          </div>
          <button
            type="button"
            className="airbnb-view-all-link"
            onClick={() => {
              setSearch("");
              setPage("Find a Workstation");
            }}
          >
            Search all tools <Icon name="ArrowRight" />
          </button>
        </div>

        {topSoftware.length ? (
          <div className="airbnb-software-grid">
            {topSoftware.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className="airbnb-software-card"
                onClick={() => {
                  setSearch(name);
                  setPage("Find a Workstation");
                }}
              >
                <div className="software-card-top">
                  <span className="software-card-name">{name}</span>
                  <span className="software-cat-chip">
                    {categorizeSoftware(name)}
                  </span>
                </div>
                <div className="software-card-bottom">
                  <span className="software-count-text">
                    <strong>{count}</strong> computer
                    {count === 1 ? "" : "s"} detected
                  </span>
                  <span className="software-card-arrow">
                    <Icon name="ArrowRight" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No records to display</h3>
            <p>No software reported by workstation monitoring agents yet.</p>
          </div>
        )}
      </section>

      {/* H. Recently Reported Workstations */}
      <section className="airbnb-recent-section">
        <div className="section-title-row">
          <div>
            <h2 className="airbnb-section-title">
              Recently Reporting Workstations
            </h2>
            <p className="airbnb-section-subtitle">
              Live heartbeat and telemetry signals received from authorized lab
              computers
            </p>
          </div>
          <button
            type="button"
            className="airbnb-view-all-link"
            onClick={() => handleQuickNav("Find a Workstation")}
          >
            View full inventory <Icon name="ArrowRight" />
          </button>
        </div>

        {recentlyActive.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Laboratory</th>
                  <th>Status</th>
                  <th>Last Reported</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentlyActive.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <strong>{w.id}</strong>
                      <span className="table-room">
                        {w.hostname || "Workstation"}
                      </span>
                    </td>
                    <td>
                      {w.lab}
                      <span className="table-room">
                        {w.room || "Room"}
                      </span>
                    </td>
                    <td>
                      <Badge status={w.status} />
                    </td>
                    <td>{timeAgo(w.lastHeartbeat || w.lastInventoryScan)}</td>
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
        ) : (
          <div className="empty-state">
            <h3>No records to display</h3>
            <p>No active workstation telemetry reported yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
