import React, { useState, useEffect, useRef } from "react";

export default function ModalDialog({ config, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (formRef.current) {
      const focusTarget =
        formRef.current.querySelector("input, textarea, select") ||
        formRef.current.querySelector("button");
      focusTarget?.focus();
    }
  }, []);

  if (!config) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const formData = new FormData(formRef.current);
    const values = Object.fromEntries(formData.entries());

    try {
      if (config.onSubmit) {
        await config.onSubmit(values);
      }
      onClose();
    } catch (err) {
      setError(err.message || "An error occurred.");
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      id="modal-backdrop"
      onClick={(e) => {
        if (e.target.id === "modal-backdrop") {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <h2 id="dialog-title">{config.title}</h2>
        {config.message && <p>{config.message}</p>}
        {config.consequences && (
          <ul className="modal-consequences">
            {config.consequences.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}

        <form
          className="dialog-form"
          id="dialog-form"
          ref={formRef}
          onSubmit={handleSubmit}
        >
          {config.children}
          {error && (
            <div className="notice error-notice" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`primary-button ${config.danger ? "danger-button" : ""}`}
              disabled={busy}
            >
              {busy ? "Working..." : config.confirmLabel || "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
