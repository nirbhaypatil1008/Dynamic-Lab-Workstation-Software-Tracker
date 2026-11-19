import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../services/api.js";
import Footer from "../components/common/Footer.jsx";
import { EMAIL_PATTERN } from "../utils/constants.js";
import { passwordPolicyError } from "../utils/helpers.js";

export default function AuthPage() {
  const { authMode, setAuthMode, setUser, setPage, error, setError, message, setMessage } =
    useApp();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    identifier: "",
    email: "",
    name: "",
    usn: "",
    employeeId: "",
    phone: "",
    department: "",
    semester: "",
    section: "",
    setupToken: "",
    code: "",
    password: "",
    confirmPassword: ""
  });

  const registration = authMode === "register";
  const setup = authMode === "setup";
  const forgot = authMode === "forgot";

  const heading = registration
    ? "Create a student account"
    : setup
    ? "Initial administrator setup"
    : forgot
    ? "Reset your password"
    : "Sign in to your account";

  const description = registration
    ? "Register with your college details to find lab workstations."
    : setup
    ? "Administrator provisioning requires an authorized setup token configured by IT."
    : forgot
    ? "Set a new password with the one-time code issued by your laboratory administrator."
    : "Access your laboratory workstation portal.";

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function handleModeSwitch(mode) {
    setAuthMode(mode);
    setError("");
    setMessage("");
    setFieldErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setFieldErrors({});

    const errors = {};
    if (authMode === "login") {
      if (!formData.identifier.trim())
        errors.identifier = "Enter your college email or registered ID.";
      if (!formData.password) errors.password = "Enter your password.";
    } else if (authMode === "register") {
      if (!EMAIL_PATTERN.test(formData.email.trim()))
        errors.email = "Enter a valid college email address.";
      if (!formData.name.trim()) errors.name = "Enter your full name.";
      if (!formData.usn.trim())
        errors.usn = "Enter your USN or registration number.";
      if (formData.phone.replace(/\D/g, "").length < 7)
        errors.phone = "Enter a valid phone number (at least 7 digits).";
      if (!formData.department.trim())
        errors.department = "Enter your department and branch.";
      if (!formData.semester.trim())
        errors.semester = "Enter your semester.";
      if (!formData.section.trim()) errors.section = "Enter your section.";
      const pol = passwordPolicyError(formData.password);
      if (pol) errors.password = pol;
      if (formData.password !== formData.confirmPassword)
        errors.confirmPassword = "The passwords do not match.";
    } else if (authMode === "setup") {
      if (!EMAIL_PATTERN.test(formData.email.trim()))
        errors.email = "Enter a valid email address.";
      if (!formData.name.trim())
        errors.name = "Enter the administrator's full name.";
      if (!formData.employeeId.trim())
        errors.employeeId = "Enter the employee ID.";
      if (!formData.department.trim())
        errors.department = "Enter the department.";
      if (!formData.setupToken.trim())
        errors.setupToken = "Enter the one-time administrator setup token.";
      const pol = passwordPolicyError(formData.password);
      if (pol) errors.password = pol;
      if (formData.password !== formData.confirmPassword)
        errors.confirmPassword = "The passwords do not match.";
    } else if (authMode === "forgot") {
      if (!EMAIL_PATTERN.test(formData.email.trim()))
        errors.email = "Enter a valid email address.";
      if (!formData.code.trim())
        errors.code = "Enter the one-time code from your administrator.";
      const pol = passwordPolicyError(formData.password);
      if (pol) errors.password = pol;
      if (formData.password !== formData.confirmPassword)
        errors.confirmPassword = "The passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      if (authMode === "forgot") {
        await api("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            email: formData.email.trim(),
            code: formData.code.trim(),
            password: formData.password,
            confirmPassword: formData.confirmPassword
          })
        });
        setLoading(false);
        setAuthMode("login");
        setMessage("Password updated. Sign in with your new password.");
        return;
      }

      const path =
        authMode === "register"
          ? "/api/auth/register"
          : authMode === "setup"
          ? "/api/auth/setup-admin"
          : "/api/auth/login";

      const payload =
        authMode === "login"
          ? { identifier: formData.identifier, password: formData.password }
          : authMode === "register"
          ? {
              name: formData.name,
              email: formData.email,
              usn: formData.usn,
              phone: formData.phone,
              department: formData.department,
              semester: formData.semester,
              section: formData.section,
              password: formData.password,
              confirmPassword: formData.confirmPassword
            }
          : {
              name: formData.name,
              email: formData.email,
              employeeId: formData.employeeId,
              department: formData.department,
              setupToken: formData.setupToken,
              password: formData.password,
              confirmPassword: formData.confirmPassword
            };

      const result = await api(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setUser(result.user);
      setPage(result.user.role === "admin" ? "Overview" : "Dashboard");
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  }

  function renderField(label, name, type = "text", required = true, autocomplete = "") {
    const isPw = type === "password";
    const isShowing = name === "password" ? showPassword : showConfirm;
    const toggleFunc =
      name === "password"
        ? () => setShowPassword((p) => !p)
        : () => setShowConfirm((p) => !p);

    const inputType = isPw ? (isShowing ? "text" : "password") : type;
    const hasError = !!fieldErrors[name];

    return (
      <label className="field">
        <span>{label}</span>
        {isPw ? (
          <div className="password-input">
            <input
              name={name}
              type={inputType}
              required={required}
              autoComplete={autocomplete}
              value={formData[name]}
              onChange={handleInputChange}
              aria-invalid={hasError ? "true" : undefined}
              aria-describedby={hasError ? `err-${name}` : undefined}
            />
            <button
              type="button"
              className="link-button"
              onClick={toggleFunc}
              aria-label={`${isShowing ? "Hide" : "Show"} password`}
            >
              {isShowing ? "Hide" : "Show"}
            </button>
          </div>
        ) : (
          <input
            name={name}
            type={inputType}
            required={required}
            autoComplete={autocomplete}
            value={formData[name]}
            onChange={handleInputChange}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={hasError ? `err-${name}` : undefined}
          />
        )}
        {hasError && (
          <span className="field-error" id={`err-${name}`}>
            {fieldErrors[name]}
          </span>
        )}
      </label>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-wrap auth-brand">
          <img
            className="brand-logo"
            src="/lab-logo.png"
            alt="Dynamic Lab logo"
          />
          <div>
            <p className="brand-title">Dynamic Lab</p>
            <span className="brand-subtitle">Workstation Tracker</span>
          </div>
        </div>

        <p className="eyebrow">Campus technology services</p>
        <h1 id="auth-title">{heading}</h1>
        <p className="auth-description">{description}</p>

        {error && (
          <div className="notice error-notice" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice success-notice" role="status">
            {message}
          </div>
        )}

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          {setup && (
            <>
              {renderField("Administrator name", "name", "text", true, "name")}
              {renderField("Institutional email", "email", "email", true, "email")}
              {renderField("Employee ID", "employeeId", "text", true, "")}
              {renderField("Department / assigned lab", "department", "text", true, "")}
              {renderField("Setup token", "setupToken", "password", true, "")}
              {renderField("Password (12+ characters)", "password", "password", true, "new-password")}
              {renderField("Confirm password", "confirmPassword", "password", true, "new-password")}
            </>
          )}

          {registration && (
            <>
              {renderField("Full name", "name", "text", true, "name")}
              {renderField("College email", "email", "email", true, "email")}
              {renderField("Student USN / registration number", "usn", "text", true, "")}
              {renderField("Phone number", "phone", "tel", true, "tel")}
              {renderField("Department and branch", "department", "text", true, "")}
              {renderField("Semester", "semester", "text", true, "")}
              {renderField("Section", "section", "text", true, "")}
              {renderField("Password (12+ characters)", "password", "password", true, "new-password")}
              {renderField("Confirm password", "confirmPassword", "password", true, "new-password")}
            </>
          )}

          {forgot && (
            <>
              <p className="read-only-note">
                This deployment does not send email. Ask your laboratory
                administrator to issue a one-time code from the Accounts page.
                Codes expire after 30 minutes.
              </p>
              {renderField("College email", "email", "email", true, "email")}
              {renderField("One-time reset code", "code", "text", true, "one-time-code")}
              {renderField("New password (12+ characters)", "password", "password", true, "new-password")}
              {renderField("Confirm new password", "confirmPassword", "password", true, "new-password")}
            </>
          )}

          {!setup && !registration && !forgot && (
            <>
              {renderField("College email or registered ID", "identifier", "text", true, "username")}
              {renderField("Password", "password", "password", true, "current-password")}
            </>
          )}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : setup
              ? "Create administrator account"
              : registration
              ? "Create student account"
              : forgot
              ? "Set new password"
              : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          {registration && (
            <button
              type="button"
              className="link-button"
              onClick={() => handleModeSwitch("login")}
            >
              Already registered? Sign in
            </button>
          )}
          {!registration && !setup && !forgot && (
            <>
              <button
                type="button"
                className="link-button"
                onClick={() => handleModeSwitch("register")}
              >
                Register as a student
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => handleModeSwitch("forgot")}
              >
                Forgot password?
              </button>
            </>
          )}
          {forgot && (
            <button
              type="button"
              className="link-button"
              onClick={() => handleModeSwitch("login")}
            >
              Back to sign in
            </button>
          )}
          <button
            type="button"
            className="link-button"
            onClick={() => handleModeSwitch(setup ? "login" : "setup")}
          >
            {setup ? "Back to sign in" : "Administrator setup"}
          </button>
        </div>

        <p className="auth-footnote">
          Administrator access is provisioned by authorized IT staff. Selecting
          a role cannot grant administrator permissions.
        </p>
      </section>

      <Footer />
    </main>
  );
}
