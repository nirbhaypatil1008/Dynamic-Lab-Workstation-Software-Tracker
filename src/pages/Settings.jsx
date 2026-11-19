import React from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../services/api.js";
import {
  themePreference,
  setThemePreference,
  applyTheme
} from "../utils/helpers.js";
import { THEME_KEY } from "../utils/constants.js";

export default function Settings() {
  const { user, setUser, setPage, setAuthMode, setError, setMessage, openDialog } =
    useApp();

  const pref = themePreference();

  function handleThemeChange(val) {
    setThemePreference(val);
    setMessage(
      `Theme set to ${val === "system" ? "system default" : `${val} mode`}.`
    );
    setError("");
  }

  function handleResetSettings() {
    openDialog({
      title: "Reset appearance settings?",
      message:
        "Your saved theme returns to the system default on this device.",
      confirmLabel: "Reset settings",
      onSubmit: async () => {
        try {
          localStorage.removeItem(THEME_KEY);
        } catch {}
        applyTheme();
        setMessage("Appearance settings reset to defaults.");
        setError("");
      }
    });
  }

  function handleLogoutAll() {
    openDialog({
      title: "Sign out of all devices?",
      message:
        "You will be signed out everywhere, including this device, and will need to sign in again.",
      confirmLabel: "Sign out everywhere",
      onSubmit: async () => {
        await api("/api/auth/logout-all", { method: "POST", body: "{}" });
        setUser(null);
        setPage("Dashboard");
        setAuthMode("login");
        setMessage("You have been signed out on all devices.");
        setError("");
      }
    });
  }

  function handleDeleteAccount() {
    openDialog({
      title: "Delete your account?",
      message:
        "This permanently removes your account and cannot be undone.",
      consequences: [
        "Your profile, contact details, and all sessions are removed.",
        "You will be signed out immediately and must register again to return.",
        "Workstation, laboratory, software, and alert records are not affected."
      ],
      confirmLabel: "Delete account",
      danger: true,
      children: (
        <>
          <label className="field">
            <span>Type DELETE to confirm</span>
            <input
              name="confirmation"
              required
              pattern="DELETE"
              autoComplete="off"
              placeholder="DELETE"
            />
          </label>
          <label className="field">
            <span>Your password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
        </>
      ),
      onSubmit: async (values) => {
        if (
          String(values.confirmation || "")
            .trim()
            .toUpperCase() !== "DELETE"
        )
          throw new Error("Type DELETE exactly to confirm.");
        await api("/api/auth/account", {
          method: "DELETE",
          body: JSON.stringify({
            password: values.password,
            confirmation: values.confirmation
          })
        });
        setUser(null);
        setPage("Dashboard");
        setAuthMode("login");
        setMessage("Your account has been deleted.");
        setError("");
      }
    });
  }

  return (
    <div className="settings-stack">
      {/* Appearance Section */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>Theme</h2>
          </div>
          <span className="demo-tag">Saved on this device</span>
        </div>
        <div className="theme-options">
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={pref === "light"}
              onChange={() => handleThemeChange("light")}
            />
            <strong>Light</strong>
            <span>Always use the light theme.</span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={pref === "dark"}
              onChange={() => handleThemeChange("dark")}
            />
            <strong>Dark</strong>
            <span>Always use the dark theme.</span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={pref === "system"}
              onChange={() => handleThemeChange("system")}
            />
            <strong>System</strong>
            <span>Match this device's appearance.</span>
          </label>
        </div>
        <p className="data-note">
          The selected theme applies immediately to every page — including
          forms, tables, dialogs, navigation, and the footer — and is stored in
          this browser.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleResetSettings}
          >
            Reset appearance to defaults
          </button>
        </div>
      </section>

      {/* Account and Security Section */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Account and security</p>
            <h2>Account</h2>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>
              Signed in as {user?.role === "admin" ? "administrator" : "student"}
            </strong>
            <p>
              {user?.email}
              {user?.phone ? ` · ${user.phone}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage("Profile")}
          >
            Edit profile
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>Password</strong>
            <p>Change your password. Every other session is signed out.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage("Profile")}
          >
            Change password
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>Sessions</strong>
            <p>Sign out on every device, including this one.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleLogoutAll}
          >
            Sign out of all devices
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="panel danger-zone">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Irreversible action</p>
            <h2>Delete account</h2>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>Delete your account</strong>
            <p>
              Removes your profile and ends all sessions. Workstation and
              laboratory records are not affected.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={handleDeleteAccount}
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
