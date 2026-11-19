import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import Icon from "../common/Icon.jsx";

export default function MobileNav() {
  const { page, setPage, setSelectedWorkstationId, setSelectedLabName } =
    useApp();

  function handleNavigate(targetPage) {
    setPage(targetPage);
    setSelectedWorkstationId("");
    setSelectedLabName("");
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button
        type="button"
        className={`mobile-nav-btn ${page === "Dashboard" ? "active" : ""}`}
        onClick={() => handleNavigate("Dashboard")}
      >
        <Icon name="Dashboard" />
        <span>Explore</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${
          page === "Find a Workstation" ? "active" : ""
        }`}
        onClick={() => handleNavigate("Find a Workstation")}
      >
        <Icon name="Find a Workstation" />
        <span>Discover</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${page === "Laboratories" ? "active" : ""}`}
        onClick={() => handleNavigate("Laboratories")}
      >
        <Icon name="Laboratories" />
        <span>Labs</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${page === "Profile" ? "active" : ""}`}
        onClick={() => handleNavigate("Profile")}
      >
        <Icon name="Profile" />
        <span>Profile</span>
      </button>
    </nav>
  );
}
