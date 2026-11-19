import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { api } from "../../services/api.js";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import AdminWorkstationTable from "../../components/admin/AdminWorkstationTable.jsx";
import ActiveEnrollmentCard from "../../components/admin/ActiveEnrollmentCard.jsx";
import LegacyCredentialPanel from "../../components/admin/LegacyCredentialPanel.jsx";

export default function AdminWorkstations({
  dashboard = {},
  workstations = []
}) {
  const {
    adminSearch,
    setAdminSearch,
    adminStatus,
    setAdminStatus,
    activeEnrollment,
    setActiveEnrollment,
    agentCredential,
    setAgentCredential,
    showManualSetup,
    setShowManualSetup,
    startEnrollmentPolling,
    stopEnrollmentPolling,
    openWorkstation,
    reconnectWorkstation,
    revokeWorkstation,
    deleteWorkstation,
    toggleMaintenance,
    triggerRefresh,
    setError,
    setMessage
  } = useApp();

  const [formBusy, setFormBusy] = useState(false);
  const [draft, setDraft] = useState({
    id: `WS-${String(workstations.length + 1).padStart(3, "0")}`,
    lab: "",
    room: ""
  });
  const [formError, setFormError] = useState({});

  const query = adminSearch.trim().toLowerCase();
  const filteredStations = workstations.filter((item) => {
    const matchesStatus = !adminStatus || item.status === adminStatus;
    const searchable = [
      item.id,
      item.hostname,
      item.lab,
      item.room,
      item.os,
      ...(item.software || []).map(
        (s) => `${s.name} ${s.version} ${s.publisher}`
      )
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!query || searchable.includes(query));
  });

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setFormError({});
    setError("");
    setMessage("");

    const errors = {};
    const stationId = draft.id.trim().toUpperCase();
    if (stationId && !/^[A-Z0-9-]{2,32}$/.test(stationId)) {
      errors.id = "Use 2 to 32 letters, numbers, or hyphens for the workstation ID.";
    }
    if (!draft.lab.trim()) {
      errors.lab = "Enter the laboratory name.";
    }

    if (Object.keys(errors).length > 0) {
      setFormError(errors);
      return;
    }

    setFormBusy(true);
    try {
      if (showManualSetup) {
        const cred = await api("/api/admin/workstations", {
          method: "POST",
          body: JSON.stringify({
            id: stationId,
            lab: draft.lab.trim(),
            room: draft.room.trim()
          })
        });
        setAgentCredential(cred);
        setActiveEnrollment(null);
        setMessage(
          "Workstation registered. Copy the manual credential below and configure its agent."
        );
      } else {
        const enrollData = await api("/api/admin/enrollment/generate", {
          method: "POST",
          body: JSON.stringify({
            workstationId: stationId,
            lab: draft.lab.trim(),
            room: draft.room.trim()
          })
        });
        setActiveEnrollment(enrollData);
        setAgentCredential(null);
        setMessage(
          `Generated 1-command installer for ${enrollData.workstationId}! Paste it into PowerShell on the lab computer.`
        );
        startEnrollmentPolling(enrollData.enrollmentId);
      }
      triggerRefresh();
      setDraft({
        id: `WS-${String(workstations.length + 2).padStart(3, "0")}`,
        lab: "",
        room: ""
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setFormBusy(false);
    }
  }

  function handleToggleDetails(expand) {
    document
      .querySelectorAll("#page-content details")
      .forEach((d) => (d.open = expand));
  }

  return (
    <div className="admin-view">
      {/* Overview Metric Row */}
      <section className="panel">
        <div className="panel-header section-header">
          <div>
            <p className="eyebrow">Current agent reports</p>
            <h2>Workstation overview</h2>
          </div>
          <span className="demo-tag">Live API · reported data</span>
        </div>
        <div className="metric-row four-up">
          <div className="metric-box">
            <span>Registered PCs</span>
            <strong>{dashboard.total || 0}</strong>
          </div>
          <div className="metric-box success">
            <span>Available</span>
            <strong>{dashboard.counts?.Available || 0}</strong>
          </div>
          <div className="metric-box info">
            <span>In use</span>
            <strong>{dashboard.counts?.["In use"] || 0}</strong>
          </div>
          <div className="metric-box warning">
            <span>Idle</span>
            <strong>{dashboard.counts?.Idle || 0}</strong>
          </div>
          <div className="metric-box danger">
            <span>Offline</span>
            <strong>{dashboard.counts?.Offline || 0}</strong>
          </div>
          <div className="metric-box neutral">
            <span>Maintenance</span>
            <strong>{dashboard.counts?.Maintenance || 0}</strong>
          </div>
        </div>
      </section>

      {/* Zero-Friction Setup Panel */}
      <section className="panel admin-table-panel">
        <div className="panel-header section-header">
          <div>
            <p className="eyebrow">Zero-Friction Device Setup</p>
            <h3>Connect New Workstation</h3>
            <p className="section-subtitle">
              Add a computer to the laboratory tracker. One PowerShell command
              on the target computer handles downloading, agent setup,
              self-registration, and background auto-start.
            </p>
          </div>
          <div className="header-action-group">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setShowManualSetup((p) => !p)}
            >
              {showManualSetup
                ? "Switch to 1-Command Auto Setup"
                : "Manual Token Setup"}
            </button>
          </div>
        </div>

        {/* Active Enrollment Card */}
        {activeEnrollment && (
          <ActiveEnrollmentCard
            enrollment={activeEnrollment}
            onDismiss={() => {
              stopEnrollmentPolling();
              setActiveEnrollment(null);
            }}
            onOpenWorkstation={openWorkstation}
          />
        )}

        {/* Legacy Manual Token Panel */}
        {agentCredential && (
          <LegacyCredentialPanel
            credential={agentCredential}
            onDismiss={() => setAgentCredential(null)}
          />
        )}

        {/* Workstation Registration Form */}
        <form
          id="register-workstation-form"
          className="register-device-form modern-enroll-form"
          onSubmit={handleRegisterSubmit}
        >
          <div className="form-grid-3">
            <label className="field">
              <span>Workstation ID</span>
              <input
                name="id"
                type="text"
                required
                value={draft.id}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    id: e.target.value.toUpperCase()
                  }))
                }
                placeholder="e.g. WS-001, LAB-PC-12"
              />
              {formError.id && (
                <span className="field-error">{formError.id}</span>
              )}
            </label>

            <label className="field">
              <span>Laboratory</span>
              <input
                name="lab"
                type="text"
                required
                value={draft.lab}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, lab: e.target.value }))
                }
                placeholder="e.g. Software Engineering Lab"
              />
              {formError.lab && (
                <span className="field-error">{formError.lab}</span>
              )}
            </label>

            <label className="field">
              <span>Room / Location</span>
              <input
                name="room"
                type="text"
                value={draft.room}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, room: e.target.value }))
                }
                placeholder="e.g. Room 302, Floor 3"
              />
            </label>
          </div>

          <div className="enroll-form-footer">
            <div className="enroll-hint">
              {showManualSetup ? (
                <>
                  <span className="hint-icon">⚙️</span>
                  <span>
                    <strong>Manual Mode:</strong> Registers database entry and
                    provides raw agent token for custom <code>.env</code>{" "}
                    configurations.
                  </span>
                </>
              ) : (
                <>
                  <span className="hint-icon">🚀</span>
                  <span>
                    <strong>Auto-Setup (Recommended):</strong> Generates an
                    instant, pre-configured PowerShell command. No python or
                    manual file editing needed on the target PC.
                  </span>
                </>
              )}
            </div>
            <button
              className="primary-button enroll-submit-btn"
              type="submit"
              disabled={formBusy}
            >
              {formBusy
                ? "Please wait..."
                : showManualSetup
                ? "Register & Generate Token"
                : "⚡ Generate 1-Command Installer"}
            </button>
          </div>
        </form>

        {/* Workstation Table Section */}
        <div className="table-section-divider" />
        <div className="panel-header">
          <div>
            <p className="eyebrow">Authorized Devices Directory</p>
            <h3>Workstation Management</h3>
          </div>
        </div>

        <AdminSearchForm
          search={adminSearch}
          status={adminStatus}
          onSearchChange={setAdminSearch}
          onStatusChange={setAdminStatus}
          onClear={() => {
            setAdminSearch("");
            setAdminStatus("");
          }}
          statuses
        />

        <div className="record-tools">
          <span className="muted-copy">
            Expand a record for grouped details.
          </span>
          <div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => handleToggleDetails(true)}
            >
              Expand all
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => handleToggleDetails(false)}
            >
              Collapse all
            </button>
          </div>
        </div>

        <AdminWorkstationTable
          workstations={filteredStations}
          onOpenWorkstation={openWorkstation}
          onReconnect={reconnectWorkstation}
          onToggleMaintenance={toggleMaintenance}
          onRevoke={revokeWorkstation}
          onDelete={deleteWorkstation}
        />
      </section>
    </div>
  );
}
