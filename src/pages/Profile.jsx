import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../services/api.js";
import { passwordPolicyError } from "../utils/helpers.js";

export default function Profile() {
  const { user, setUser, setError, setMessage } = useApp();

  const isAdmin = user?.role === "admin";
  const identityLabel = isAdmin ? "Employee ID" : "Student USN";
  const identityNote = isAdmin
    ? "Email and employee ID identify your administrator account and cannot be changed here. Contact IT to request a change."
    : "College email and USN identify your account and cannot be changed here. Contact your laboratory administrator to request a change.";

  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    department: user?.department || "",
    semester: user?.semester || "",
    section: user?.section || ""
  });
  const [profileErrors, setProfileErrors] = useState({});

  const [pwData, setPwData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [pwErrors, setPwErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileErrors({});
    setError("");
    setMessage("");

    const errors = {};
    if (!profileData.name.trim()) errors.name = "Enter your full name.";
    const digits = profileData.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15)
      errors.phone = "Enter a valid phone number (7 to 15 digits).";
    if (!isAdmin && !profileData.department.trim())
      errors.department = "Enter your department and branch.";
    if (!isAdmin && !profileData.semester.trim())
      errors.semester = "Enter your semester.";
    if (!isAdmin && !profileData.section.trim())
      errors.section = "Enter your section.";

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    try {
      const result = await api("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(profileData)
      });
      setUser(result.user);
      setEditing(false);
      setMessage("Profile changes saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwErrors({});
    setError("");
    setMessage("");

    const errors = {};
    if (!pwData.currentPassword)
      errors.currentPassword = "Enter your current password.";
    const policy = passwordPolicyError(pwData.newPassword);
    if (policy) errors.newPassword = policy;
    if (pwData.newPassword !== pwData.confirmPassword)
      errors.confirmPassword = "The passwords do not match.";
    if (pwData.newPassword === pwData.currentPassword)
      errors.newPassword = "Choose a password different from your current one.";

    if (Object.keys(errors).length > 0) {
      setPwErrors(errors);
      return;
    }

    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(pwData)
      });
      setMessage("Password updated. Other devices were signed out.");
      setPwData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="settings-stack">
      {/* Profile Details Panel */}
      {editing ? (
        <section className="panel profile-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Editable information</p>
              <h2>Edit profile</h2>
            </div>
          </div>
          <form
            id="profile-form"
            className="profile-form"
            onSubmit={handleProfileSubmit}
            noValidate
          >
            <div className="profile-grid">
              <label className="field">
                <span>Full name</span>
                <input
                  name="name"
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData((p) => ({ ...p, name: e.target.value }))
                  }
                  aria-invalid={profileErrors.name ? "true" : undefined}
                />
                {profileErrors.name && (
                  <span className="field-error">{profileErrors.name}</span>
                )}
              </label>

              <label className="field">
                <span>Phone number</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData((p) => ({ ...p, phone: e.target.value }))
                  }
                  aria-invalid={profileErrors.phone ? "true" : undefined}
                />
                {profileErrors.phone && (
                  <span className="field-error">{profileErrors.phone}</span>
                )}
              </label>

              <label className="field">
                <span>Department and branch</span>
                <input
                  name="department"
                  type="text"
                  required
                  value={profileData.department}
                  onChange={(e) =>
                    setProfileData((p) => ({
                      ...p,
                      department: e.target.value
                    }))
                  }
                  aria-invalid={profileErrors.department ? "true" : undefined}
                />
                {profileErrors.department && (
                  <span className="field-error">
                    {profileErrors.department}
                  </span>
                )}
              </label>

              {!isAdmin && (
                <>
                  <label className="field">
                    <span>Semester</span>
                    <input
                      name="semester"
                      type="text"
                      required
                      value={profileData.semester}
                      onChange={(e) =>
                        setProfileData((p) => ({
                          ...p,
                          semester: e.target.value
                        }))
                      }
                      aria-invalid={profileErrors.semester ? "true" : undefined}
                    />
                    {profileErrors.semester && (
                      <span className="field-error">
                        {profileErrors.semester}
                      </span>
                    )}
                  </label>

                  <label className="field">
                    <span>Section</span>
                    <input
                      name="section"
                      type="text"
                      required
                      value={profileData.section}
                      onChange={(e) =>
                        setProfileData((p) => ({
                          ...p,
                          section: e.target.value
                        }))
                      }
                      aria-invalid={profileErrors.section ? "true" : undefined}
                    />
                    {profileErrors.section && (
                      <span className="field-error">
                        {profileErrors.section}
                      </span>
                    )}
                  </label>
                </>
              )}

              <p className="read-only-note">
                <strong>{user?.email}</strong> · {identityLabel}:{" "}
                {user?.identifier} — {identityNote}
              </p>
            </div>
            <div className="profile-actions">
              <button className="primary-button" type="submit">
                Save changes
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="panel profile-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Account information</p>
              <h2>Your profile</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setProfileData({
                  name: user?.name || "",
                  phone: user?.phone || "",
                  department: user?.department || "",
                  semester: user?.semester || "",
                  section: user?.section || ""
                });
                setEditing(true);
              }}
            >
              Edit profile
            </button>
          </div>
          <ul className="detail-list">
            <li>
              <span>Name</span>
              <strong>{user?.name}</strong>
            </li>
            <li>
              <span>Email</span>
              <strong>{user?.email}</strong>
            </li>
            <li>
              <span>{identityLabel}</span>
              <strong>{user?.identifier}</strong>
            </li>
            <li>
              <span>Phone</span>
              <strong>{user?.phone || "Not provided"}</strong>
            </li>
            <li>
              <span>Department</span>
              <strong>{user?.department || "Not provided"}</strong>
            </li>
            {!isAdmin && (
              <li>
                <span>Semester / section</span>
                <strong>
                  {[user?.semester, user?.section].filter(Boolean).join(" / ") ||
                    "Not provided"}
                </strong>
              </li>
            )}
            <li>
              <span>Role</span>
              <strong>{isAdmin ? "Administrator" : "Student"}</strong>
            </li>
          </ul>
        </section>
      )}

      {/* Change Password Panel */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Account security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <form
          id="change-password-form"
          className="change-password-form"
          onSubmit={handlePasswordSubmit}
          noValidate
        >
          <div className="form-grid">
            <label className="field">
              <span>Current password</span>
              <div className="password-input">
                <input
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={pwData.currentPassword}
                  onChange={(e) =>
                    setPwData((p) => ({
                      ...p,
                      currentPassword: e.target.value
                    }))
                  }
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowCurrent((p) => !p)}
                >
                  {showCurrent ? "Hide" : "Show"}
                </button>
              </div>
              {pwErrors.currentPassword && (
                <span className="field-error">{pwErrors.currentPassword}</span>
              )}
            </label>

            <label className="field">
              <span>New password (12+ characters)</span>
              <div className="password-input">
                <input
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  required
                  value={pwData.newPassword}
                  onChange={(e) =>
                    setPwData((p) => ({
                      ...p,
                      newPassword: e.target.value
                    }))
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowNew((p) => !p)}
                >
                  {showNew ? "Hide" : "Show"}
                </button>
              </div>
              {pwErrors.newPassword && (
                <span className="field-error">{pwErrors.newPassword}</span>
              )}
            </label>

            <label className="field">
              <span>Confirm new password</span>
              <div className="password-input">
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={pwData.confirmPassword}
                  onChange={(e) =>
                    setPwData((p) => ({
                      ...p,
                      confirmPassword: e.target.value
                    }))
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowConfirm((p) => !p)}
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
              {pwErrors.confirmPassword && (
                <span className="field-error">{pwErrors.confirmPassword}</span>
              )}
            </label>

            <p className="read-only-note">
              Passwords require at least 12 characters with an uppercase letter,
              a lowercase letter, and a number. Changing your password signs out
              your account on every device.
            </p>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Update password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
