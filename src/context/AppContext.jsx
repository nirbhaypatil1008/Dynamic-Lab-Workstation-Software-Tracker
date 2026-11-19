import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "../services/api.js";
import {
  themePreference,
  applyTheme,
  setThemePreference
} from "../utils/helpers.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState("Dashboard");
  const [returnPage, setReturnPage] = useState("Dashboard");
  const [selectedWorkstationId, setSelectedWorkstationId] = useState("");
  const [selectedLabName, setSelectedLabName] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("id-asc");

  const [search, setSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [lab, setLab] = useState("");
  const [os, setOs] = useState("");
  const [availability, setAvailability] = useState("");
  const [workstationSoftwareSearch, setWorkstationSoftwareSearch] = useState("");
  const [labSearch, setLabSearch] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Workstations");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [activeEnrollment, setActiveEnrollment] = useState(null);
  const [agentCredential, setAgentCredential] = useState(null);
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [resetCredential, setResetCredential] = useState(null);

  const [dialogConfig, setDialogConfig] = useState(null);
  const [apiLatency, setApiLatency] = useState(12);
  const [refreshKey, setRefreshKey] = useState(0);

  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("lab-favorites") || "[]"));
    } catch {
      return new Set();
    }
  });

  const enrollmentPollTimer = useRef(null);

  // Initialize theme on mount
  useEffect(() => {
    applyTheme();
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (themePreference() === "system") applyTheme();
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  function toggleTheme() {
    const current = themePreference();
    const next =
      current === "dark" ||
      (current === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "light"
        : "dark";
    setThemePreference(next);
    setMessage(`Theme switched to ${next} mode.`);
    setError("");
  }

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("lab-favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  function triggerRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function openDialog(cfg) {
    setDialogConfig(cfg);
  }

  function closeDialog() {
    setDialogConfig(null);
  }

  function stopEnrollmentPolling() {
    if (enrollmentPollTimer.current) {
      clearInterval(enrollmentPollTimer.current);
      enrollmentPollTimer.current = null;
    }
  }

  function startEnrollmentPolling(enrollmentId) {
    stopEnrollmentPolling();
    enrollmentPollTimer.current = setInterval(async () => {
      try {
        const statusRes = await api(
          `/api/admin/enrollment/${encodeURIComponent(enrollmentId)}/status`
        );
        setActiveEnrollment((prev) => {
          if (!prev || prev.enrollmentId !== enrollmentId) {
            stopEnrollmentPolling();
            return prev;
          }
          const prevStatus = prev.status;
          const updated = {
            ...prev,
            status: statusRes.status,
            progressMessage: statusRes.progressMessage,
            errorMessage: statusRes.errorMessage,
            targetHostname: statusRes.targetHostname,
            targetIp: statusRes.targetIp
          };
          if (
            statusRes.status === "completed" ||
            statusRes.status === "expired" ||
            statusRes.status === "revoked" ||
            statusRes.status === "failed"
          ) {
            stopEnrollmentPolling();
            if (statusRes.status === "completed" && prevStatus !== "completed") {
              setMessage(
                `Workstation ${statusRes.workstationId} successfully connected and active!`
              );
              triggerRefresh();
            }
          }
          return updated;
        });
      } catch {
        // Ignore polling transient errors
      }
    }, 2500);
  }

  // Workstation navigation helpers
  function openWorkstation(id) {
    setReturnPage(page === "System details" ? returnPage : page);
    setSelectedWorkstationId(id);
    setWorkstationSoftwareSearch("");
    setPage("System details");
    setError("");
    setMessage("");
  }

  function backToWorkstations() {
    setPage(returnPage);
    setSelectedWorkstationId("");
    setWorkstationSoftwareSearch("");
  }

  async function logout() {
    stopEnrollmentPolling();
    setActiveEnrollment(null);
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setError("");
    } catch {
      setError(
        "The server could not confirm sign out. Close this browser session and retry when the API is available."
      );
    }
    setUser(null);
    setPage("Dashboard");
    setAuthMode("login");
  }

  async function reconnectWorkstation(workstationId) {
    try {
      const reconnectData = await api(
        `/api/admin/workstations/${encodeURIComponent(workstationId)}/reconnect`,
        { method: "POST", body: "{}" }
      );
      setActiveEnrollment(reconnectData);
      setPage("Workstations");
      setMessage(
        `Generated 1-command installer for ${workstationId}! Run it on the lab computer.`
      );
      setError("");
      startEnrollmentPolling(reconnectData.enrollmentId);
      triggerRefresh();
      setTimeout(() => {
        document
          .getElementById("active-enrollment-panel")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeWorkstation(workstationId) {
    if (
      !window.confirm(
        `Revoke access for workstation ${workstationId}?\n\nThe agent on this computer will be immediately disconnected and cannot submit metrics or software inventory until re-enrolled.`
      )
    ) {
      return;
    }
    try {
      await api(
        `/api/admin/workstations/${encodeURIComponent(workstationId)}/revoke`,
        { method: "POST", body: "{}" }
      );
      setMessage(`Workstation ${workstationId} access has been revoked.`);
      setError("");
      triggerRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteWorkstation(workstationId) {
    if (
      !window.confirm(
        `Permanently delete workstation ${workstationId}?\n\nThis will remove the workstation from the system, including its software inventory, metrics history, alerts, and enrollment records.\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api(
        `/api/admin/workstations/${encodeURIComponent(workstationId)}`,
        { method: "DELETE" }
      );
      setMessage(`Workstation ${workstationId} has been permanently deleted.`);
      setError("");
      if (selectedWorkstationId === workstationId) {
        setSelectedWorkstationId("");
        setPage("Workstations");
      }
      triggerRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleMaintenance(workstationId, isCurrentlyMaintenance) {
    if (isCurrentlyMaintenance) {
      try {
        await api(
          `/api/admin/workstations/${encodeURIComponent(workstationId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ maintenance: false, note: "" })
          }
        );
        setError("");
        setMessage("Workstation restored.");
        triggerRefresh();
      } catch (err) {
        setError(err.message);
      }
      return;
    }

    openDialog({
      title: `Mark ${workstationId} for maintenance?`,
      message:
        "The workstation will be reported as in maintenance until an administrator restores it.",
      confirmLabel: "Start maintenance",
      children: (
        <label className="field">
          <span>Describe the maintenance issue</span>
          <input
            name="note"
            required
            maxLength={300}
            autoComplete="off"
            placeholder="e.g. Faulty power supply, sent for service"
          />
        </label>
      ),
      onSubmit: async (values) => {
        const note = String(values.note || "").trim();
        if (!note)
          throw new Error(
            "Enter a short issue description before marking the workstation for maintenance."
          );
        await api(
          `/api/admin/workstations/${encodeURIComponent(workstationId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ maintenance: true, note })
          }
        );
        setError("");
        setMessage("Workstation marked for maintenance.");
        triggerRefresh();
      }
    });
  }

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        authMode,
        setAuthMode,
        page,
        setPage,
        returnPage,
        setReturnPage,
        selectedWorkstationId,
        setSelectedWorkstationId,
        selectedLabName,
        setSelectedLabName,
        viewMode,
        setViewMode,
        sortBy,
        setSortBy,
        search,
        setSearch,
        adminSearch,
        setAdminSearch,
        adminStatus,
        setAdminStatus,
        lab,
        setLab,
        os,
        setOs,
        availability,
        setAvailability,
        workstationSoftwareSearch,
        setWorkstationSoftwareSearch,
        labSearch,
        setLabSearch,
        error,
        setError,
        message,
        setMessage,
        activeCategory,
        setActiveCategory,
        userMenuOpen,
        setUserMenuOpen,
        activeEnrollment,
        setActiveEnrollment,
        agentCredential,
        setAgentCredential,
        showManualSetup,
        setShowManualSetup,
        resetCredential,
        setResetCredential,
        dialogConfig,
        openDialog,
        closeDialog,
        apiLatency,
        setApiLatency,
        refreshKey,
        triggerRefresh,
        favorites,
        toggleFavorite,
        toggleTheme,
        startEnrollmentPolling,
        stopEnrollmentPolling,
        openWorkstation,
        backToWorkstations,
        logout,
        reconnectWorkstation,
        revokeWorkstation,
        deleteWorkstation,
        toggleMaintenance
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
