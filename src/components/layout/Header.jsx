import React, { useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext.jsx";
import Icon from "../common/Icon.jsx";
import { adminPages } from "../../utils/constants.js";
import { themePreference } from "../../utils/helpers.js";

export default function Header() {
  const {
    user,
    page,
    setPage,
    setSelectedWorkstationId,
    setSelectedLabName,
    toggleTheme,
    triggerRefresh,
    userMenuOpen,
    setUserMenuOpen,
    logout
  } = useApp();

  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        userMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen, setUserMenuOpen]);

  const isStudent = user?.role === "student";
  const displayName = user?.name || user?.email || "Student";
  const initial = (displayName[0] || "S").toUpperCase();
  const pref = themePreference();
  const isDark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  function handleNavigate(targetPage) {
    setPage(targetPage);
    setSelectedWorkstationId("");
    setSelectedLabName("");
    setUserMenuOpen(false);
  }

  const isAdminHubActive =
    adminPages.includes(page) &&
    ![
      "Dashboard",
      "Find a Workstation",
      "Laboratories",
      "Profile",
      "Settings"
    ].includes(page);

  return (
    <header className="airbnb-header">
      <div className="airbnb-header-inner">
        {/* Left: Logo & Brand */}
        <a
          href="#/dashboard"
          className="airbnb-brand"
          onClick={(e) => {
            e.preventDefault();
            handleNavigate("Dashboard");
          }}
          aria-label="Dynamic Lab Home"
        >
          <img
            className="airbnb-logo"
            src="/lab-logo.png"
            alt="Dynamic Lab logo"
          />
          <div className="airbnb-brand-text">
            <span className="airbnb-brand-title">Dynamic Lab</span>
            <span className="airbnb-brand-subtitle">Workstation Tracker</span>
          </div>
        </a>

        {/* Center: Airbnb Pill Navigation */}
        <nav className="airbnb-center-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`airbnb-nav-pill ${page === "Dashboard" ? "active" : ""}`}
            onClick={() => handleNavigate("Dashboard")}
            aria-current={page === "Dashboard" ? "page" : undefined}
          >
            <Icon name="Dashboard" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`airbnb-nav-pill ${
              page === "Find a Workstation" ? "active" : ""
            }`}
            onClick={() => handleNavigate("Find a Workstation")}
            aria-current={page === "Find a Workstation" ? "page" : undefined}
          >
            <Icon name="Find a Workstation" />
            <span>Find Workstations</span>
          </button>
          <button
            type="button"
            className={`airbnb-nav-pill ${
              page === "Laboratories" ? "active" : ""
            }`}
            onClick={() => handleNavigate("Laboratories")}
            aria-current={page === "Laboratories" ? "page" : undefined}
          >
            <Icon name="Laboratories" />
            <span>Laboratories</span>
          </button>
          {!isStudent && (
            <button
              type="button"
              className={`airbnb-nav-pill ${isAdminHubActive ? "active" : ""}`}
              onClick={() => handleNavigate("Overview")}
            >
              <Icon name="Server" />
              <span>Admin Hub</span>
            </button>
          )}
        </nav>

        {/* Right: Theme Switcher, Telemetry Refresh & User Capsule */}
        <div className="airbnb-right-actions">
          <button
            type="button"
            className="airbnb-icon-btn"
            onClick={toggleTheme}
            title={`Switch theme (${isDark ? "Dark" : "Light"})`}
            aria-label="Toggle theme"
          >
            <Icon name={isDark ? "Sun" : "Moon"} />
          </button>
          <button
            type="button"
            className="airbnb-icon-btn"
            onClick={triggerRefresh}
            title="Refresh live telemetry"
            aria-label="Refresh telemetry"
          >
            <Icon name="Refresh data" />
          </button>

          <div className="airbnb-user-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="airbnb-user-capsule"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen ? "true" : "false"}
              aria-label="User account menu"
            >
              <span className="airbnb-hamburger-lines">
                <Icon name="Menu" />
              </span>
              <div className="airbnb-avatar-circle">{initial}</div>
              <span className="airbnb-user-firstname">
                {user?.name ? user.name.split(" ")[0] : "Student"}
              </span>
            </button>

            {userMenuOpen && (
              <div
                className="airbnb-dropdown-menu"
                id="user-dropdown-menu"
                role="menu"
              >
                <div className="dropdown-header">
                  <strong>{displayName}</strong>
                  <span className="dropdown-role-badge">
                    {user?.role}{" "}
                    {user?.department ? `· ${user.department}` : ""}
                  </span>
                  {user?.identifier && (
                    <span className="dropdown-usn">
                      USN / ID: {user.identifier}
                    </span>
                  )}
                </div>
                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleNavigate("Dashboard")}
                >
                  <Icon name="Dashboard" /> <span>Dashboard Explore</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleNavigate("Find a Workstation")}
                >
                  <Icon name="Find a Workstation" />{" "}
                  <span>Find a Workstation</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleNavigate("Laboratories")}
                >
                  <Icon name="Laboratories" /> <span>Explore Laboratories</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleNavigate("Profile")}
                >
                  <Icon name="Profile" /> <span>My Profile</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => handleNavigate("Settings")}
                >
                  <Icon name="Settings" /> <span>Settings & Appearance</span>
                </button>

                {!isStudent && (
                  <>
                    <div className="dropdown-divider" />
                    <div className="dropdown-section-title">
                      Admin Management
                    </div>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Overview")}
                    >
                      <Icon name="Overview" /> <span>Overview</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Workstations")}
                    >
                      <Icon name="Workstations" /> <span>Workstation Fleet</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Accounts")}
                    >
                      <Icon name="Accounts" /> <span>Account Manager</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Software Inventory")}
                    >
                      <Icon name="Software Inventory" />{" "}
                      <span>Software Catalog</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("System Health")}
                    >
                      <Icon name="System Health" /> <span>System Health</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Alerts")}
                    >
                      <Icon name="Alerts" /> <span>Alerts & Telemetry</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("Reports")}
                    >
                      <Icon name="Reports" /> <span>Operational Reports</span>
                    </button>
                  </>
                )}

                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item text-danger"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  <Icon name="Sign out" /> <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
