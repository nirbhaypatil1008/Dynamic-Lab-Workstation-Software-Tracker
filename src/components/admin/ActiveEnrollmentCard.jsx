import React, { useState } from "react";

export default function ActiveEnrollmentCard({
  enrollment,
  onDismiss,
  onOpenWorkstation
}) {
  const [copied, setCopied] = useState(false);

  if (!enrollment) return null;

  const isCompleted = enrollment.status === "completed";
  const isFailed = enrollment.status === "failed";
  const isExpired = enrollment.status === "expired";
  const isRevoked = enrollment.status === "revoked";

  const getStepState = (stepNumber) => {
    if (isCompleted) return "completed";
    if (isFailed || isExpired || isRevoked) return "halted";
    const statusMap = {
      pending: 1,
      command_executed: 2,
      installing: 2,
      registering: 3,
      claimed: 3,
      completed: 4
    };
    const current = statusMap[enrollment.status] || 1;
    if (current > stepNumber) return "completed";
    if (current === stepNumber) return "active";
    return "pending";
  };

  async function handleCopy() {
    if (enrollment.command) {
      try {
        await navigator.clipboard.writeText(enrollment.command);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        console.error("Clipboard copy failed", err);
      }
    }
  }

  return (
    <div
      className={`enrollment-active-card ${
        isCompleted ? "enrollment-completed-card" : ""
      }`}
      id="active-enrollment-panel"
    >
      <div className="enrollment-card-header">
        <div className="enrollment-card-title">
          <span
            className={`pulse-indicator ${
              isCompleted
                ? "pulse-success"
                : isFailed
                ? "pulse-failed"
                : "pulse-active"
            }`}
          />
          <div>
            <h4>
              {isCompleted
                ? "Workstation Connected Successfully!"
                : `Waiting for Connection: ${enrollment.workstationId}`}
            </h4>
            <p className="muted-copy">
              Laboratory:{" "}
              <strong>{enrollment.lab || "Main Laboratory"}</strong>{" "}
              {enrollment.room ? `· ${enrollment.room}` : ""} · Token valid for 15
              minutes
            </p>
          </div>
        </div>
        <div className="enrollment-card-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={onDismiss}
          >
            {isCompleted ? "Close Banner" : "Dismiss"}
          </button>
        </div>
      </div>

      {!isCompleted ? (
        <div className="enrollment-body">
          <div className="enrollment-instructions">
            <strong>Step 1:</strong> On the computer you want to add (
            <strong>{enrollment.workstationId}</strong>), open{" "}
            <strong>PowerShell as Administrator</strong>.<br />
            <strong>Step 2:</strong> Paste and run this one-line setup command:
          </div>

          <div className="enrollment-command-container">
            <div className="command-box-shell">
              <pre>
                <code>{enrollment.command}</code>
              </pre>
            </div>
            <button
              type="button"
              className="primary-button copy-cmd-btn"
              onClick={handleCopy}
            >
              {copied ? "✓ Copied to Clipboard!" : "📋 Copy PowerShell Command"}
            </button>
          </div>

          {/* 4-step live visual progress tracker */}
          <div className="enrollment-progress-tracker">
            <div className={`progress-step step-${getStepState(1)}`}>
              <div className="step-circle">
                {getStepState(1) === "completed" ? "✓" : "1"}
              </div>
              <div className="step-info">
                <span className="step-title">Command Ready</span>
                <span className="step-sub">Awaiting execution</span>
              </div>
            </div>
            <div className="progress-divider" />
            <div className={`progress-step step-${getStepState(2)}`}>
              <div className="step-circle">
                {getStepState(2) === "completed" ? "✓" : "2"}
              </div>
              <div className="step-info">
                <span className="step-title">Connecting</span>
                <span className="step-sub">Installer running</span>
              </div>
            </div>
            <div className="progress-divider" />
            <div className={`progress-step step-${getStepState(3)}`}>
              <div className="step-circle">
                {getStepState(3) === "completed" ? "✓" : "3"}
              </div>
              <div className="step-info">
                <span className="step-title">Self-Registering</span>
                <span className="step-sub">Keys exchange</span>
              </div>
            </div>
            <div className="progress-divider" />
            <div className={`progress-step step-${getStepState(4)}`}>
              <div className="step-circle">
                {getStepState(4) === "completed" ? "✓" : "4"}
              </div>
              <div className="step-info">
                <span className="step-title">Online & Active</span>
                <span className="step-sub">Live telemetry</span>
              </div>
            </div>
          </div>

          <div className="enrollment-status-bar">
            <span className={`status-pill status-${enrollment.status}`}>
              {String(enrollment.status || "").toUpperCase().replace("_", " ")}
            </span>
            <span className="status-message">
              {enrollment.progressMessage ||
                "Waiting for target computer to execute the command..."}
            </span>
            {enrollment.targetIp && (
              <span className="target-ip-badge">IP: {enrollment.targetIp}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="enrollment-success-content">
          <div className="success-icon-banner">🎉</div>
          <div className="success-details">
            <h3>{enrollment.workstationId} is Live and Connected!</h3>
            <p>
              The monitoring agent has successfully registered, verified
              telemetry, and is transmitting real-time hardware metrics and
              software inventory.
            </p>
            {enrollment.targetHostname && (
              <p className="device-meta">
                Hostname: <strong>{enrollment.targetHostname}</strong> · IP:{" "}
                <strong>{enrollment.targetIp || "LAN"}</strong>
              </p>
            )}
          </div>
          <div className="success-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenWorkstation(enrollment.workstationId)}
            >
              View Workstation Dashboard
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onDismiss}
            >
              Add Another Workstation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
