import React, { useState } from "react";

export default function LegacyCredentialPanel({ credential, onDismiss }) {
  const [copied, setCopied] = useState(false);

  if (!credential) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(credential.agentToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  }

  return (
    <div className="credential-panel" role="status">
      <div
        className="credential-panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <strong>⚠️ Manual Agent Credential Generated</strong>
        <button
          type="button"
          className="compact-button secondary-button"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
      <p>
        Workstation ID: <strong>{credential.workstationId}</strong>
      </p>
      <code>{credential.agentToken}</code>
      <div className="credential-actions" style={{ margin: "8px 0" }}>
        <button
          type="button"
          className="secondary-button"
          onClick={handleCopy}
        >
          {copied ? "✓ Copied to Clipboard!" : "Copy token"}
        </button>
      </div>
      <p className="credential-note">
        Configure the authorized computer by pasting this token into{" "}
        <code>agent/.env</code> (<code>AGENT_TOKEN={credential.agentToken}</code>
        ). Do not share it.
      </p>
    </div>
  );
}
