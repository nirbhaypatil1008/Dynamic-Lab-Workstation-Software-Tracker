import React from "react";
import Icon from "../common/Icon.jsx";

export default function AdminSearchForm({
  search = "",
  status = "",
  onSearchChange,
  onStatusChange,
  onClear,
  statuses = false,
  placeholder = "Search workstations, labs, or software"
}) {
  return (
    <form
      id="admin-search-form"
      className="admin-search-form"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="field search-field">
        <span>Search inventory</span>
        <div className="input-shell">
          <Icon name="Find a Workstation" />
          <input
            name="adminSearch"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            aria-label="Search administrator records"
          />
        </div>
      </label>

      {statuses && (
        <label className="field">
          <span>Workstation status</span>
          <select
            name="adminStatus"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">All statuses</option>
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
      )}

      {(search || status) && (
        <button
          type="button"
          className="secondary-button"
          onClick={onClear}
        >
          Clear
        </button>
      )}
    </form>
  );
}
