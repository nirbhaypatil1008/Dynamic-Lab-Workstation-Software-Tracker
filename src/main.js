import "./style.css";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:3001")).replace(/\/$/, "");
const app = document.querySelector("#app");
const state = {
  user: null,
  authMode: "login",
  page: "Dashboard",
  returnPage: "Dashboard",
  selectedWorkstationId: "",
  workstationSoftwareSearch: "",
  error: "",
  message: "",
  search: "",
  adminSearch: "",
  adminStatus: "",
  lab: "",
  os: "",
  availability: "",
  agentCredential: null,
  resetCredential: null,
  authLoading: false,
  listPages: {},
  refreshSequence: 0,
  profileEditing: false,
  profileDraft: null,
  authDraft: {},
  workstationDraft: null,
  formBusy: false
};

const studentPages = ["Dashboard", "Find a Workstation", "Laboratories", "Profile", "Settings"];
const adminPages = ["Overview", "Workstations", "Laboratories", "Software Inventory", "System Health", "Alerts", "Maintenance", "Reports", "Accounts", "Profile", "Settings"];
const pageSubtitles = {
  Profile: "View and update your account details and password.",
  Settings: "Manage appearance and account security preferences.",
  Accounts: "Review campus accounts and issue one-time password reset codes."
};
const THEME_KEY = "lab-tracker-theme";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let searchTimer;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

/* ---------------- Theme ---------------- */

function themePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return ["light", "dark", "system"].includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme() {
  const pref = themePreference();
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0E141B" : "#23415C";
}

function setThemePreference(value) {
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    /* storage unavailable; theme still applies for this visit */
  }
  applyTheme();
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themePreference() === "system") applyTheme();
});
applyTheme();

/* ---------------- Footer and static pages ---------------- */

const staticPages = {
  about: {
    title: "About",
    eyebrow: "About this application",
    body: `
      <p><strong>Dynamic Lab Workstation Tracker</strong> shows which laboratory workstations are registered with this service and what their authorized monitoring agents have reported: heartbeat, health metrics, and detected software inventory.</p>
      <h2>How the data reaches this portal</h2>
      <p>Nothing is seeded or simulated. Each workstation runs an institution-authorized agent that reports to this API. A workstation is shown as available only when it has a recent heartbeat, fresh metrics, and an explicit availability signal from that agent.</p>
      <h2>Who uses it</h2>
      <ul>
        <li><strong>Students</strong> search reported software to find a lab workstation that meets their requirements and check its status before visiting the lab.</li>
        <li><strong>Administrators</strong> register workstations, issue device credentials, monitor system health, and manage alerts and maintenance states.</li>
      </ul>
      <h2>Accounts and sessions</h2>
      <p>Accounts are provisioned for the institution: students register with their college details, and the first administrator is created with a one-time setup token configured by IT. Sessions use an HTTP-only cookie and expire after 12 hours.</p>`
  },
  contact: {
    title: "Contact",
    eyebrow: "Getting help from people",
    body: `
      <p>This application is operated by your institution. There is no public support desk built into the portal itself.</p>
      <h2>Account or lab access problems</h2>
      <ul>
        <li>Contact your <strong>laboratory administrator or institutional IT helpdesk</strong>. Include your name, USN or employee ID, and the laboratory you use.</li>
        <li>For a forgotten password, ask your administrator to issue a one-time reset code from the Accounts page.</li>
      </ul>
      <h2>Workstation problems</h2>
      <ul>
        <li>If a workstation shows as offline or its data looks outdated, report the <strong>workstation ID</strong> and lab to your administrator. Status depends on the agent running on that machine.</li>
        <li>Only authorized staff can register devices or rotate device credentials.</li>
      </ul>
      <h2>Portal unavailable</h2>
      <p>If pages show "Could not load this page", the API server may be stopped or unreachable. Report it to your IT helpdesk rather than retrying repeatedly.</p>`
  },
  help: {
    title: "Help",
    eyebrow: "Using the portal",
    body: `
      <h2>Finding a workstation (students)</h2>
      <ul>
        <li>Open <strong>Find a Workstation</strong> and type the software you need (for example Python or MongoDB). Results match against freshly reported inventories.</li>
        <li>Use the laboratory, operating system, and status filters to narrow the list, and <strong>Clear filters</strong> to reset them.</li>
        <li>Select <strong>View system details</strong> on a card to open the full record and search the software on that specific system.</li>
      </ul>
      <h2>Managing workstations (administrators)</h2>
      <ul>
        <li><strong>Workstations → Register workstation</strong> creates a device record and displays its agent token once. Store it securely; use <strong>Rotate token</strong> if it is lost or exposed.</li>
        <li><strong>Maintenance</strong> / <strong>Restore</strong> changes the server-side maintenance flag for a device.</li>
        <li><strong>Accounts</strong> can issue a one-time password reset code for a user.</li>
      </ul>
      <h2>Password rules</h2>
      <p>Passwords must be at least 12 characters and include an uppercase letter, a lowercase letter, and a number. They are stored only as salted bcrypt hashes.</p>
      <h2>Theme</h2>
      <p>Settings → Appearance switches between light, dark, and system themes. The choice is saved in this browser.</p>`
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Last updated for this deployment",
    body: `
      <p>This policy describes what the Dynamic Lab Workstation Tracker stores and why. It reflects what this application actually does; it does not claim any external certification.</p>
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, college email, USN or employee ID, phone number, department, semester, and section, provided at registration or when you edit your profile.</li>
        <li><strong>Password:</strong> stored only as a salted bcrypt hash. Plaintext passwords are never stored or logged.</li>
        <li><strong>Session data:</strong> an HTTP-only session cookie that expires after 12 hours.</li>
        <li><strong>Workstation telemetry:</strong> reported by authorized agents — hostname, operating system, hardware capacity, health metrics, heartbeat timestamps, and installed-software inventory.</li>
        <li><strong>Audit records:</strong> administrative actions (registration, token rotation, password changes) are logged for operational accountability.</li>
      </ul>
      <h2>How it is used</h2>
      <p>To let students find suitable workstations, let administrators monitor and manage devices, and keep accounts secure. The application does not include third-party analytics, advertising, or tracking scripts.</p>
      <h2>Storage and retention</h2>
      <p>Data is stored in a SQLite database on the institution-operated server. Workstation records belong to the institution, not to individual accounts. Deleting your account removes your profile and sessions; it does not remove workstation or laboratory records.</p>
      <h2>Your choices</h2>
      <ul>
        <li>You can review and edit your profile details from the <strong>Profile</strong> page.</li>
        <li>You can delete your account from <strong>Settings → Delete account</strong>, which signs out all sessions.</li>
        <li>Ask your administrator to correct records you cannot change yourself, such as your registered email.</li>
      </ul>`
  },
  terms: {
    title: "Terms of Service",
    eyebrow: "Acceptable use",
    body: `
      <p>By using the Dynamic Lab Workstation Tracker you agree to use it only for authorized institutional purposes.</p>
      <h2>Accounts</h2>
      <ul>
        <li>Accounts are personal. Do not share your password or use another person's account.</li>
        <li>Provide accurate registration details and keep your profile current.</li>
        <li>Administrators may suspend or remove accounts that violate institutional policy.</li>
      </ul>
      <h2>Acceptable use</h2>
      <ul>
        <li>Use the portal to find and manage laboratory resources for legitimate coursework or duties.</li>
        <li>Do not attempt to access other accounts, tamper with monitoring agents, or interfere with the service.</li>
        <li>Device credentials (agent tokens) are institution-controlled and must not be shared.</li>
      </ul>
      <h2>Data accuracy</h2>
      <p>Workstation status and software lists reflect what authorized agents last reported. They may be stale if an agent is offline, and they are provided for guidance, not as a guarantee of availability.</p>
      <h2>Service limitations</h2>
      <p>This deployment is an operational tool provided by the institution on an "as available" basis. It makes no warranty of uninterrupted access, and the institution may change or withdraw features with reasonable notice.</p>`
  }
};

function footer() {
  const links = [["about", "About"], ["contact", "Contact"], ["help", "Help"], ["privacy", "Privacy Policy"], ["terms", "Terms of Service"]];
  return `<footer class="site-footer">
    <span>Dynamic Lab Workstation Tracker</span>
    <nav aria-label="Footer links">${links.map(([slug, label]) => `<a href="#/${slug}">${label}</a>`).join("")}</nav>
  </footer>`;
}

function routeSlug() {
  const match = /^#\/([a-z-]+)$/.exec(location.hash);
  if (!match) return null;
  return staticPages[match[1]] ? match[1] : "not-found";
}

function renderStaticPage(slug) {
  const page = slug === "not-found"
    ? {
      title: "Page not found",
      eyebrow: "404",
      body: `<p>The page you requested does not exist or may have been moved.</p><p><strong><a href="#/help">Visit the Help page</a></strong> or return to the application.</p>`
    }
    : staticPages[slug];
  return `<div class="static-page">
    <header class="static-header">
      <div class="brand-wrap"><img class="brand-logo" src="/lab-logo.png" alt="Dynamic Lab logo" /><div><p class="brand-title">Dynamic Lab</p><span class="brand-subtitle">Workstation Tracker</span></div></div>
      <button type="button" class="secondary-button" data-action="static-back">Back to ${state.user ? "application" : "sign in"}</button>
    </header>
    <main class="static-main">
      <section class="panel">
        <div class="panel-header"><div><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1></div></div>
        <div class="legal-content">${page.body}</div>
      </section>
      ${footer()}
    </main>
  </div>`;
}

function renderRoutedPage() {
  const slug = routeSlug();
  if (!slug) return false;
  app.innerHTML = renderStaticPage(slug);
  return true;
}

/* ---------------- Confirmation dialog ---------------- */

function closeDialog() {
  document.getElementById("modal-backdrop")?.remove();
}

function openDialog(config) {
  closeDialog();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <h2 id="dialog-title">${escapeHtml(config.title)}</h2>
    ${config.message ? `<p>${escapeHtml(config.message)}</p>` : ""}
    ${config.consequences ? `<ul class="modal-consequences">${config.consequences.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    <form class="dialog-form" id="dialog-form">
      ${config.body || ""}
      <div id="dialog-feedback"></div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" data-dialog-cancel>Cancel</button>
        <button type="submit" class="primary-button ${config.danger ? "danger-button" : ""}">${escapeHtml(config.confirmLabel || "Confirm")}</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDialog();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog();
  });
  backdrop.querySelector("[data-dialog-cancel]").addEventListener("click", closeDialog);
  const form = backdrop.querySelector("#dialog-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy === "true") return;
    form.dataset.busy = "true";
    const submit = form.querySelector('button[type="submit"]');
    const feedback = form.querySelector("#dialog-feedback");
    feedback.innerHTML = "";
    submit.disabled = true;
    submit.textContent = "Working...";
    try {
      await config.onSubmit(Object.fromEntries(new FormData(form).entries()));
      closeDialog();
    } catch (error) {
      feedback.innerHTML = `<div class="notice error-notice" role="alert">${escapeHtml(error.message)}</div>`;
      submit.disabled = false;
      submit.textContent = config.confirmLabel || "Confirm";
      delete form.dataset.busy;
    }
  });
  const focusTarget = form.querySelector("input, textarea, select") || form.querySelector("button");
  focusTarget?.focus();
}

/* ---------------- Inline field validation ---------------- */

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((node) => node.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  });
}

function injectFieldError(form, name, message) {
  const input = form.elements[name];
  if (!input) return;
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", `err-${name}`);
  const label = input.closest(".field");
  if (label && !label.querySelector(".field-error")) {
    label.insertAdjacentHTML("beforeend", `<span class="field-error" id="err-${name}">${escapeHtml(message)}</span>`);
  }
}

function passwordPolicyError(password) {
  if (typeof password !== "string" || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 12 characters with uppercase, lowercase, and a number.";
  }
  return "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function icon(name) {
  const paths = {
    Dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    Overview: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    "Find a Workstation": '<circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path>',
    Laboratories: '<path d="M4 20h16M6 20V8l6-4 6 4v12M9 12h6"></path>',
    Profile: '<circle cx="12" cy="8" r="4"></circle><path d="M5 20c1-3.2 3.4-5 7-5s6 1.8 7 5"></path>',
    "Sign out": '<path d="M10 17l5-5-5-5M15 12H3"></path><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"></path>',
    Workstations: '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
    "Software Inventory": '<path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"></path>',
    "System Health": '<path d="M3 12h4l2-7 4 14 2-7h6"></path>',
    Alerts: '<path d="m12 3 9 17H3L12 3z"></path><path d="M12 9v4m0 3h.01"></path>',
    Maintenance: '<path d="m14 7 3 3M4 20l7-7m4-9a4 4 0 0 0 5 5l-4 4-5-5 4-4a4 4 0 0 0-5 5l-6 6a2 2 0 1 0 3 3l6-6"></path>',
    Reports: '<path d="M6 3h9l5 5v13H6zM15 3v5h5M9 13h7M9 17h7"></path>',
    Settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.2.62.77 1.05 1.42 1.06H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z"></path>',
    Accounts: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
    Menu: '<path d="M4 6h16M4 12h16M4 18h16"></path>',
    "Refresh data": '<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"></path>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.Dashboard}</svg>`;
}

function statusClass(status) {
  return ({
    Available: "available", "In use": "occupied", Idle: "warning",
    Offline: "offline", Maintenance: "maintenance", Unknown: "warning"
  })[status] || "neutral";
}

function badge(status) {
  return `<span class="status-badge ${statusClass(status)}">${escapeHtml(status || "Unknown")}</span>`;
}

function field(label, name, type = "text", required = true, autocomplete = "", value = "") {
  const input = `<input name="${name}" type="${type}" ${required ? "required" : ""} autocomplete="${autocomplete}"${type !== "password" && value !== "" ? ` value="${escapeHtml(value)}"` : ""} />`;
  return type === "password"
    ? `<label class="field"><span>${escapeHtml(label)}</span><div class="password-input">${input}<button type="button" class="link-button" data-action="reveal-password" aria-label="Show password">Show</button></div></label>`
    : `<label class="field"><span>${escapeHtml(label)}</span>${input}</label>`;
}

function renderAuth() {
  const mode = state.authMode;
  const registration = mode === "register";
  const setup = mode === "setup";
  const forgot = mode === "forgot";
  const draft = state.authDraft || {};
  const heading = registration ? "Create a student account" : setup ? "Initial administrator setup" : forgot ? "Reset your password" : "Sign in to your account";
  const description = registration
    ? "Register with your college details to find lab workstations."
    : setup
      ? "Administrator provisioning requires an authorized setup token configured by IT."
      : forgot
        ? "Set a new password with the one-time code issued by your laboratory administrator."
        : "Access your laboratory workstation portal.";
  const formFields = setup
    ? `${field("Administrator name", "name", "text", true, "name", draft.name || "")}${field("Institutional email", "email", "email", true, "email", draft.email || "")}${field("Employee ID", "employeeId", "text", true, "", draft.employeeId || "")}${field("Department / assigned lab", "department", "text", true, "", draft.department || "")}${field("Setup token", "setupToken", "password")}${field("Password (12+ characters)", "password", "password", true, "new-password")}${field("Confirm password", "confirmPassword", "password", true, "new-password")}`
    : registration
      ? `${field("Full name", "name", "text", true, "name", draft.name || "")}${field("College email", "email", "email", true, "email", draft.email || "")}${field("Student USN / registration number", "usn", "text", true, "", draft.usn || "")}${field("Phone number", "phone", "tel", true, "tel", draft.phone || "")}${field("Department and branch", "department", "text", true, "", draft.department || "")}${field("Semester", "semester", "text", true, "", draft.semester || "")}${field("Section", "section", "text", true, "", draft.section || "")}${field("Password (12+ characters)", "password", "password", true, "new-password")}${field("Confirm password", "confirmPassword", "password", true, "new-password")}`
      : forgot
        ? `<p class="read-only-note">This deployment does not send email. Ask your laboratory administrator to issue a one-time code from the Accounts page. Codes expire after 30 minutes.</p>${field("College email", "email", "email", true, "email", draft.email || "")}${field("One-time reset code", "code", "text", true, "one-time-code", draft.code || "")}${field("New password (12+ characters)", "password", "password", true, "new-password")}${field("Confirm new password", "confirmPassword", "password", true, "new-password")}`
        : `${field("College email or registered ID", "identifier", "text", true, "username", draft.identifier || "")}${field("Password", "password", "password", true, "current-password")}`;

  return `
    <main class="auth-page">
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="brand-wrap auth-brand"><img class="brand-logo" src="/lab-logo.png" alt="Dynamic Lab logo" /><div><p class="brand-title">Dynamic Lab</p><span class="brand-subtitle">Workstation Tracker</span></div></div>
        <p class="eyebrow">Campus technology services</p>
        <h1 id="auth-title">${heading}</h1>
        <p class="auth-description">${description}</p>
        ${state.error ? `<div class="notice error-notice" role="alert">${escapeHtml(state.error)}</div>` : ""}
        ${state.message ? `<div class="notice success-notice" role="status">${escapeHtml(state.message)}</div>` : ""}
        <form id="auth-form" class="auth-form">
          ${formFields}          <button class="primary-button auth-submit" type="submit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Please wait..." : setup ? "Create administrator account" : registration ? "Create student account" : forgot ? "Set new password" : "Sign in"}</button>
        </form>
        <div class="auth-switch">
          ${registration ? `<button type="button" class="link-button" data-auth-mode="login">Already registered? Sign in</button>` : ""}
          ${!registration && !setup && !forgot ? `<button type="button" class="link-button" data-auth-mode="register">Register as a student</button><button type="button" class="link-button" data-auth-mode="forgot">Forgot password?</button>` : ""}
          ${forgot ? `<button type="button" class="link-button" data-auth-mode="login">Back to sign in</button>` : ""}
          <button type="button" class="link-button" data-auth-mode="${setup ? "login" : "setup"}">${setup ? "Back to sign in" : "Administrator setup"}</button>
        </div>
        <p class="auth-footnote">Administrator access is provisioned by authorized IT staff. Selecting a role cannot grant administrator permissions.</p>
      </section>
      ${footer()}
    </main>`;
}

function navLabels() {
  return state.user.role === "admin" ? adminPages : studentPages;
}

function renderShell(content) {
  const pages = navLabels();
  const displayName = state.user.name || state.user.email;
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-wrap"><img class="brand-logo" src="/lab-logo.png" alt="Dynamic Lab logo" /><div><p class="brand-title">Dynamic Lab</p><span class="brand-subtitle">Workstation Tracker</span></div><button type="button" class="mobile-nav-toggle" data-action="toggle-nav" aria-expanded="false" aria-controls="main-nav" aria-label="Toggle navigation menu">${icon("Menu")}</button></div>
        <nav id="main-nav" class="nav-group" aria-label="Main navigation">
          ${pages.map((page) => `<button type="button" class="nav-item ${state.page === page ? "active" : ""}" data-page="${escapeHtml(page)}" ${state.page === page ? 'aria-current="page"' : ""}>${icon(page)}<span>${escapeHtml(page)}</span></button>`).join("")}
          <button type="button" class="nav-item" data-action="logout">${icon("Sign out")}<span>Sign out</span></button>
        </nav>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div><p class="eyebrow">${state.user.role === "admin" ? "Administrator portal" : "Student portal"}</p><h1>${escapeHtml(state.page === "System details" ? state.selectedWorkstationId : state.page)}</h1></div>
          <div class="header-actions"><span class="user-label">${escapeHtml(displayName)} · ${escapeHtml(state.user.role)}</span><button type="button" class="secondary-button" data-action="refresh" aria-label="Refresh current page">${icon("Refresh data")}<span>Refresh data</span></button></div>
        </header>
        <p class="page-subtitle">${state.page === "System details" ? "Review structured system information and search its detected software inventory." : pageSubtitles[state.page] || (state.user.role === "admin" ? "Monitor authorized workstation reports and manage lab equipment." : "Search reported software inventory and check workstation status before visiting a lab.")}</p>
        ${state.error ? `<div class="notice error-notice" role="alert">${escapeHtml(state.error)}</div>` : ""}
        ${state.message ? `<div class="notice success-notice" role="status">${escapeHtml(state.message)}</div>` : ""}
        <div id="page-content">${content}</div>
        ${footer()}
      </main>
    </div>`;
}

function emptyPanel(message) {
  return `<div class="empty-state"><h3>No records to display</h3><p>${escapeHtml(message)}</p></div>`;
}

function inventoryFreshness(item) {
  return item.inventoryFreshness === "Fresh"
    ? '<span class="freshness fresh">Fresh inventory</span>'
    : '<span class="freshness stale">Stale or unknown inventory</span>';
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "Not reported";
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(0)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function structuredFields(fields) {
  return `<dl class="structured-fields">${fields.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "Not reported")}</dd></div>`
  ).join("")}</dl>`;
}

function softwareDetails(items, label = "Detected software") {
  return `<details class="structured-details software-details">
    <summary>${escapeHtml(label)} <span class="detail-count">${items.length}</span></summary>
    ${items.length ? `<ul class="software-inventory-list">${items.map((item) => `<li>
      <strong>${escapeHtml(item.name)}</strong>
      ${structuredFields([
        ["Version", item.version || "Not reported"],
        ["Publisher", item.publisher || "Not reported"],
        ["Detection source", item.source || "Not reported"],
        ["Last detected", formatDate(item.detected_at)]
      ])}
    </li>`).join("")}</ul>` : '<p class="muted-copy">No detected software has been reported.</p>'}
  </details>`;
}

function pageItems(items, scope, pageSize = 15) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(state.listPages[scope] || 0, pageCount - 1);
  state.listPages[scope] = currentPage;
  const start = currentPage * pageSize;
  const visibleItems = items.slice(start, start + pageSize);
  const from = items.length ? start + 1 : 0;
  const to = Math.min(start + pageSize, items.length);
  const controls = items.length > pageSize ? `<nav class="pagination" aria-label="${escapeHtml(scope)} pagination">
    <span>Showing ${from}–${to} of ${items.length}</span>
    <div><button type="button" class="secondary-button compact-button" data-action="page-previous" data-scope="${escapeHtml(scope)}" ${currentPage === 0 ? "disabled" : ""}>Previous</button>
    <span class="page-count">Page ${currentPage + 1} of ${pageCount}</span>
    <button type="button" class="secondary-button compact-button" data-action="page-next" data-scope="${escapeHtml(scope)}" ${currentPage >= pageCount - 1 ? "disabled" : ""}>Next</button></div>
  </nav>` : items.length ? `<p class="list-count">Showing ${items.length} ${escapeHtml(scope)}</p>` : "";
  return { items: visibleItems, controls };
}

function structuredWorkstationDetails(item) {
  return `<details class="structured-details workstation-details">
    <summary>Structured details</summary>
    <div class="structured-detail-grid">
      <section><h4>Identification</h4>${structuredFields([
        ["Workstation ID", item.id], ["Hostname", item.hostname],
        ["Laboratory", item.lab], ["Room", item.room], ["Status", item.status]
      ])}</section>
      <section><h4>System and hardware</h4>${structuredFields([
        ["Operating system", item.os], ["Processor", item.cpu],
        ["Memory capacity", formatBytes(item.memoryTotalBytes)], ["Disk capacity", formatBytes(item.diskTotalBytes)]
      ])}</section>
      <section><h4>Connectivity and inventory</h4>${structuredFields([
        ["Last heartbeat", formatDate(item.lastHeartbeat)],
        ["Inventory scan", formatDate(item.lastInventoryScan)],
        ["Inventory freshness", item.inventoryFreshness],
        ["Network", item.health?.network],
        ["Metrics reported", formatDate(item.health?.reportedAt)]
      ])}</section>
      <section><h4>Latest health metrics</h4>${structuredFields([
        ["CPU usage", item.health?.cpuPercent == null ? "Not available" : `${item.health.cpuPercent}%`],
        ["Memory usage", item.health?.memoryPercent == null ? "Not available" : `${item.health.memoryPercent}%`],
        ["Disk usage", item.health?.diskPercent == null ? "Not available" : `${item.health.diskPercent}%`]
      ])}</section>
    </div>
    ${softwareDetails(item.software)}
  </details>`;
}

function renderWorkstationCard(item) {
  const software = item.software.slice(0, 4).map((program) =>
    `<span class="chip soft">${escapeHtml(program.name)}${program.version ? ` ${escapeHtml(program.version)}` : ""}</span>`
  ).join("");
  return `<article class="workstation-card">
    <div class="card-header"><div><p class="eyebrow">${escapeHtml(item.lab)} · ${escapeHtml(item.room || "Room not reported")}</p><h3>${escapeHtml(item.id)}</h3></div>${badge(item.status)}</div>
    <div class="card-meta"><span>${escapeHtml(item.hostname || "Hostname not reported")}</span><span>${escapeHtml(item.os || "OS not reported")}</span></div>
    <div class="software-row">${software || '<span class="muted-label">No software scan reported</span>'}${item.software.length > 4 ? `<span class="chip soft">+${item.software.length - 4} more</span>` : ""}</div>
    <dl class="station-stats"><div><dt>Operating system</dt><dd>${escapeHtml(item.os || "Not reported")}</dd></div><div><dt>Inventory</dt><dd>${escapeHtml(item.inventoryFreshness)}</dd></div><div><dt>Last update</dt><dd>${escapeHtml(formatDate(item.lastHeartbeat))}</dd></div></dl>
    <button type="button" class="primary-button workstation-open-button" data-action="open-workstation" data-id="${escapeHtml(item.id)}">View system details</button>
    <div class="card-footer">${inventoryFreshness(item)}</div>
  </article>`;
}

function renderWorkstationPage(item) {
  const search = state.workstationSoftwareSearch.trim().toLocaleLowerCase();
  const software = item.software.filter((program) =>
    !search || `${program.name} ${program.version} ${program.publisher} ${program.source}`.toLocaleLowerCase().includes(search)
  );
  const otherSystems = item.allWorkstations || [];
  const otherMatches = search
    ? otherSystems.filter((system) => system.id !== item.id && system.inventoryFreshness === "Fresh" &&
      system.software.some((program) => `${program.name} ${program.version} ${program.publisher}`.toLocaleLowerCase().includes(search)))
    : [];

  return `<div class="workstation-detail-page">
    <button type="button" class="back-link" data-action="back-to-workstations">← Back to ${escapeHtml(state.returnPage)}</button>
    <section class="panel workstation-hero">
      <div class="workstation-hero-heading">
        <div><p class="eyebrow">Full system record · ${escapeHtml(item.lab)}</p><h2>${escapeHtml(item.id)}</h2><p class="muted-copy">${escapeHtml(item.hostname || "Hostname not reported")} · ${escapeHtml(item.room || "Room not reported")}</p></div>
        ${badge(item.status)}
      </div>
      <p class="data-note">${item.inventoryFreshness === "Fresh" ? "Inventory is recently reported by the authorized agent." : "The inventory is stale or missing. Treat this software list as last reported information, not confirmation of current installation."}</p>
    </section>
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">Structured system information</p><h3>Workstation details</h3></div></div>
      <div class="system-detail-sections">
        <section><h4>Identification and assignment</h4>${structuredFields([
          ["Workstation ID", item.id], ["Hostname", item.hostname], ["Laboratory", item.lab], ["Room", item.room], ["Status", item.status]
        ])}</section>
        <section><h4>Operating system and hardware</h4>${structuredFields([
          ["Operating system", item.os], ["Processor", item.cpu], ["Memory capacity", formatBytes(item.memoryTotalBytes)], ["Disk capacity", formatBytes(item.diskTotalBytes)]
        ])}</section>
        <section><h4>Connectivity and inventory freshness</h4>${structuredFields([
          ["Last heartbeat", formatDate(item.lastHeartbeat)], ["Last successful inventory scan", formatDate(item.lastInventoryScan)],
          ["Inventory freshness", item.inventoryFreshness], ["Network connectivity", item.health?.network],
          ["Metrics last reported", formatDate(item.health?.reportedAt)]
        ])}</section>
        <section><h4>Latest resource metrics</h4>${structuredFields([
          ["CPU usage", item.health?.cpuPercent == null ? "Not available" : `${item.health.cpuPercent}%`],
          ["Memory usage", item.health?.memoryPercent == null ? "Not available" : `${item.health.memoryPercent}%`],
          ["Disk usage", item.health?.diskPercent == null ? "Not available" : `${item.health.diskPercent}%`]
        ])}</section>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">Search detected applications</p><h3>Software on ${escapeHtml(item.id)}</h3></div><span class="demo-tag">${software.length} match${software.length === 1 ? "" : "es"}</span></div>
      <form id="workstation-software-search" class="workstation-software-search">
        <label class="field"><span>Find required software on this system</span><div class="input-shell">${icon("Find a Workstation")}<input type="search" name="softwareSearch" value="${escapeHtml(state.workstationSoftwareSearch)}" placeholder="Search Python, MongoDB, Java..." aria-label="Search software on this workstation" /></div></label>
        <button type="submit" class="primary-button">Search software</button>
        <button type="button" class="secondary-button" data-action="clear-workstation-search">Clear</button>
      </form>
      ${software.length ? `<div class="system-software-list">${software.map((program) => `<article class="system-software-item">
        <div class="system-software-heading"><div><h4>${escapeHtml(program.name)}</h4><span>${escapeHtml(program.version || "Version not reported")}</span></div><span class="freshness ${item.inventoryFreshness === "Fresh" ? "fresh" : "stale"}">${escapeHtml(item.inventoryFreshness)} inventory</span></div>
        ${structuredFields([
          ["Publisher", program.publisher || "Not reported"], ["Detection source", program.source || "Not reported"],
          ["Last detected", formatDate(program.detected_at)]
        ])}
      </article>`).join("")}</div>` : emptyPanel(search ? `No reported application on ${item.id} matches “${state.workstationSoftwareSearch}”.` : "This workstation has no reported software inventory yet.")}
      ${search ? `<section class="other-systems-results"><h4>Other systems with a fresh match</h4>${otherMatches.length ? `<ul>${otherMatches.map((system) => `<li>${badge(system.status)}<span><strong>${escapeHtml(system.id)}</strong> · ${escapeHtml(system.lab)}</span><button type="button" class="secondary-button compact-button" data-action="open-workstation" data-id="${escapeHtml(system.id)}">View system</button></li>`).join("")}</ul>` : '<p class="muted-copy">No other system has a fresh inventory match for this search.</p>'}</section>` : ""}
    </section>
  </div>`;
}

function studentFilters(labs, workstations) {
  const osList = [...new Set(workstations.map((item) => item.os).filter(Boolean))];
  return `<form id="student-search-form" class="filter-grid">
    <label class="field wide"><span>Search detected software</span><div class="input-shell">${icon("Find a Workstation")}<input name="software" type="search" value="${escapeHtml(state.search)}" placeholder="Search Python, Java, MongoDB..." aria-label="Search installed software" /></div></label>
    <label class="field"><span>Laboratory</span><select name="lab"><option value="">All labs</option>${labs.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === state.lab ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
    <label class="field"><span>Operating system</span><select name="os"><option value="">All operating systems</option>${osList.map((os) => `<option value="${escapeHtml(os)}" ${os === state.os ? "selected" : ""}>${escapeHtml(os)}</option>`).join("")}</select></label>
    <label class="field"><span>Status</span><select name="availability"><option value="">All statuses</option>${["Available", "In use", "Idle", "Offline", "Maintenance", "Unknown"].map((status) => `<option ${state.availability === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
    <button type="submit" class="primary-button">Search workstations</button>
    <button type="button" class="secondary-button" data-action="clear-student-filters">Clear filters</button>
  </form>`;
}

function profileFieldValues() {
  const user = state.user;
  const draft = state.profileDraft || {};
  return {
    name: draft.name ?? user.name ?? "",
    phone: draft.phone ?? user.phone ?? "",
    department: draft.department ?? user.department ?? "",
    semester: draft.semester ?? user.semester ?? "",
    section: draft.section ?? user.section ?? ""
  };
}

function renderProfilePage() {
  const user = state.user;
  const isAdmin = user.role === "admin";
  const v = profileFieldValues();
  const identityLabel = isAdmin ? "Employee ID" : "Student USN";
  const identityNote = isAdmin
    ? "Email and employee ID identify your administrator account and cannot be changed here. Contact IT to request a change."
    : "College email and USN identify your account and cannot be changed here. Contact your laboratory administrator to request a change.";

  const detailsPanel = state.profileEditing
    ? `<section class="panel profile-panel">
        <div class="panel-header"><div><p class="eyebrow">Editable information</p><h2>Edit profile</h2></div></div>
        <form id="profile-form" class="profile-form" novalidate>
          <div class="profile-grid">
            ${field("Full name", "name", "text", true, "name", v.name)}
            ${field("Phone number", "phone", "tel", true, "tel", v.phone)}
            ${field("Department and branch", "department", "text", true, "", v.department)}
            ${isAdmin ? "" : `${field("Semester", "semester", "text", true, "", v.semester)}${field("Section", "section", "text", true, "", v.section)}`}
            <p class="read-only-note"><strong>${escapeHtml(user.email)}</strong> · ${escapeHtml(identityLabel)}: ${escapeHtml(user.identifier)} — ${identityNote}</p>
          </div>
          <div class="profile-actions">
            <button class="primary-button" type="submit">Save changes</button>
            <button class="secondary-button" type="button" data-action="cancel-profile">Cancel</button>
          </div>
        </form>
      </section>`
    : `<section class="panel profile-panel">
        <div class="panel-header"><div><p class="eyebrow">Account information</p><h2>Your profile</h2></div><button type="button" class="secondary-button" data-action="edit-profile">Edit profile</button></div>
        <ul class="detail-list">
          <li><span>Name</span><strong>${escapeHtml(user.name)}</strong></li>
          <li><span>Email</span><strong>${escapeHtml(user.email)}</strong></li>
          <li><span>${identityLabel}</span><strong>${escapeHtml(user.identifier)}</strong></li>
          <li><span>Phone</span><strong>${escapeHtml(user.phone || "Not provided")}</strong></li>
          <li><span>Department</span><strong>${escapeHtml(user.department || "Not provided")}</strong></li>
          ${isAdmin ? "" : `<li><span>Semester / section</span><strong>${escapeHtml([user.semester, user.section].filter(Boolean).join(" / ") || "Not provided")}</strong></li>`}
          <li><span>Role</span><strong>${isAdmin ? "Administrator" : "Student"}</strong></li>
        </ul>
      </section>`;

  const passwordPanel = `<section class="panel">
    <div class="panel-header"><div><p class="eyebrow">Account security</p><h2>Change password</h2></div></div>
    <form id="change-password-form" class="change-password-form" novalidate>
      <div class="form-grid">
        ${field("Current password", "currentPassword", "password", true, "current-password")}
        ${field("New password (12+ characters)", "newPassword", "password", true, "new-password")}
        ${field("Confirm new password", "confirmPassword", "password", true, "new-password")}
        <p class="read-only-note">Passwords require at least 12 characters with an uppercase letter, a lowercase letter, and a number. Changing your password signs out your account on every device.</p>
      </div>
      <div class="form-actions"><button class="primary-button" type="submit">Update password</button></div>
    </form>
  </section>`;

  return `<div class="settings-stack">${detailsPanel}${passwordPanel}</div>`;
}

function renderSettingsPage() {
  const pref = themePreference();
  const user = state.user;
  const themeCard = (value, title, copy) => `<label class="theme-option">
    <input type="radio" name="theme" value="${value}" ${pref === value ? "checked" : ""} />
    <strong>${title}</strong><span>${copy}</span>
  </label>`;
  return `<div class="settings-stack">
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">Appearance</p><h2>Theme</h2></div><span class="demo-tag">Saved on this device</span></div>
      <div class="theme-options">
        ${themeCard("light", "Light", "Always use the light theme.")}
        ${themeCard("dark", "Dark", "Always use the dark theme.")}
        ${themeCard("system", "System", "Match this device's appearance.")}
      </div>
      <p class="data-note">The selected theme applies immediately to every page — including forms, tables, dialogs, navigation, and the footer — and is stored in this browser.</p>
      <div class="form-actions"><button type="button" class="secondary-button" data-action="reset-settings">Reset appearance to defaults</button></div>
    </section>
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">Account and security</p><h2>Account</h2></div></div>
      <div class="settings-row">
        <div><strong>Signed in as ${user.role === "admin" ? "administrator" : "student"}</strong><p>${escapeHtml(user.email)}${user.phone ? ` · ${escapeHtml(user.phone)}` : ""}</p></div>
        <button type="button" class="secondary-button" data-action="edit-profile">Edit profile</button>
      </div>
      <div class="settings-row">
        <div><strong>Password</strong><p>Change your password. Every other session is signed out.</p></div>
        <button type="button" class="secondary-button" data-action="change-password">Change password</button>
      </div>
      <div class="settings-row">
        <div><strong>Sessions</strong><p>Sign out on every device, including this one.</p></div>
        <button type="button" class="secondary-button" data-action="logout-all">Sign out of all devices</button>
      </div>
    </section>
    <section class="panel danger-zone">
      <div class="panel-header"><div><p class="eyebrow">Irreversible action</p><h2>Delete account</h2></div></div>
      <div class="settings-row">
        <div><strong>Delete your account</strong><p>Removes your profile and ends all sessions. Workstation and laboratory records are not affected.</p></div>
        <button type="button" class="secondary-button danger-button" data-action="delete-account">Delete account</button>
      </div>
    </section>
  </div>`;
}

function renderAccountsPage(users) {
  const query = state.adminSearch.toLocaleLowerCase();
  const rows = users.filter((account) => !query || `${account.name} ${account.email} ${account.identifier} ${account.role} ${account.department}`.toLocaleLowerCase().includes(query));
  const page = pageItems(rows, "accounts");
  const credential = state.resetCredential;
  return `<section class="panel">
    <div class="panel-header section-header"><div><p class="eyebrow">Campus accounts</p><h2>Accounts</h2></div><span class="demo-tag">${users.length} registered account${users.length === 1 ? "" : "s"}</span></div>
    ${adminSearchForm({ placeholder: "Search name, email, or ID" })}
    ${credential ? `<div class="credential-panel" role="status"><strong>One-time reset code for ${escapeHtml(credential.email)}</strong><code>${escapeHtml(credential.code)}</code><div><button type="button" class="secondary-button" data-action="copy-reset-code">Copy code</button></div><p>Expires in ${credential.expiresInMinutes} minutes and can be shown only once. Share it with the account owner through an approved channel.</p></div>` : ""}
    ${rows.length ? `${page.controls}<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>ID</th><th>Role</th><th>Department</th><th>Actions</th></tr></thead>
      <tbody>${page.items.map((account) => `<tr>
        <td>${escapeHtml(account.name)}</td>
        <td>${escapeHtml(account.email)}</td>
        <td>${escapeHtml(account.identifier)}</td>
        <td><span class="chip">${account.role === "admin" ? "Administrator" : "Student"}</span></td>
        <td>${escapeHtml(account.department || "Not provided")}</td>
        <td class="table-actions"><button type="button" class="secondary-button compact-button" data-action="issue-reset-code" data-id="${escapeHtml(account.id)}">Reset password</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyPanel("No accounts match the current search.")}
  </section>`;
}

async function renderStudentPage() {
  if (state.page === "Profile") return renderProfilePage();
  if (state.page === "Settings") return renderSettingsPage();
  if (state.page === "System details") {
    const response = await api("/api/student/workstations");
    const selected = response.workstations.find((item) => item.id === state.selectedWorkstationId);
    if (!selected) return emptyPanel("This workstation is no longer available to your account. Return to the workstation list and choose another.");
    return renderWorkstationPage({ ...selected, allWorkstations: response.workstations });
  }
  const params = new URLSearchParams();
  if (state.search) params.set("software", state.search);
  if (state.lab) params.set("lab", state.lab);
  if (state.os) params.set("os", state.os);
  const [labResponse, workstationResponse] = await Promise.all([
    api("/api/student/labs"),
    api(`/api/student/workstations${params.size ? `?${params}` : ""}`)
  ]);
  const stations = workstationResponse.workstations.filter((item) => !state.availability || item.status === state.availability);
  const page = pageItems(stations, "workstations");
  const availableCount = workstationResponse.workstations.filter((item) => item.status === "Available").length;
  const inventoryFresh = workstationResponse.workstations.filter((item) => item.inventoryFreshness === "Fresh").length;
  return `<section class="panel main-panel">
    <div class="panel-header section-header"><div><p class="eyebrow">Reported workstation data</p><h2>${state.page === "Laboratories" ? "Laboratories" : "Find a workstation"}</h2></div><span class="demo-tag">Live API · reported data</span></div>
    ${studentFilters(labResponse.labs, workstationResponse.workstations)}
    <div class="summary-row">
      <div class="metric-box light"><span>Available now</span><strong>${availableCount}</strong></div>
      <div class="metric-box light"><span>Registered PCs</span><strong>${workstationResponse.workstations.length}</strong></div>
      <div class="metric-box light"><span>Fresh inventories</span><strong>${inventoryFresh}</strong></div>
      <div class="metric-box light"><span>Matching results</span><strong>${stations.length}</strong></div>
    </div>
    <p class="data-note">Availability is shown only when the workstation agent has reported a reliable status. Unknown, offline, or stale inventory is not treated as available.</p>
    ${recordTools()}
    ${page.items.length ? `${page.controls}<div class="card-grid">${page.items.map(renderWorkstationCard).join("")}</div>` : emptyPanel(state.search ? "No fresh detected software inventory matched that search." : "No registered workstation reports are available yet.")}
  </section>`;
}

function metricBox(label, value, className = "") {
  return `<div class="metric-box ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function adminWorkstationTable(rows) {
  if (!rows.length) return emptyPanel("Register a workstation and install its authorized monitoring agent to begin receiving data.");
  const page = pageItems(rows, "workstations");
  return `${page.controls}<div class="table-wrap"><table><thead><tr><th>Workstation</th><th>Laboratory</th><th>Status</th><th>OS</th><th>Heartbeat</th><th>Inventory scan</th><th>Health</th><th>Actions</th></tr></thead><tbody>${page.items.map((item) => `<tr>
    <td><button type="button" class="table-link" data-action="open-workstation" data-id="${escapeHtml(item.id)}">${escapeHtml(item.id)}</button><span class="table-room">${escapeHtml(item.hostname || "Hostname not reported")}</span>${structuredWorkstationDetails(item)}</td>
    <td>${escapeHtml(item.lab)}<span class="table-room">${escapeHtml(item.room || "Room not reported")}</span></td><td>${badge(item.status)}</td>
    <td>${escapeHtml(item.os || "Not available")}</td><td>${escapeHtml(formatDate(item.lastHeartbeat))}</td>
    <td>${escapeHtml(formatDate(item.lastInventoryScan))}<span class="table-room">${escapeHtml(item.inventoryFreshness)}</span></td>
    <td>${escapeHtml(item.health?.cpuPercent == null ? "Not available" : `${item.health.cpuPercent}% CPU`)}<span class="table-room">${escapeHtml(item.health?.network || "Not available")} network</span></td>
    <td class="table-actions"><button type="button" class="secondary-button compact-button" data-action="toggle-maintenance" data-id="${escapeHtml(item.id)}" data-maintenance="${item.status === "Maintenance"}">${item.status === "Maintenance" ? "Restore" : "Maintenance"}</button><button type="button" class="secondary-button compact-button" data-action="rotate-agent-token" data-id="${escapeHtml(item.id)}">Rotate token</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function adminSearchForm({ statuses = false, placeholder = "Search workstations, labs, or software" } = {}) {
  return `<form id="admin-search-form" class="admin-search-form">
    <label class="field search-field"><span>Search inventory</span><div class="input-shell">${icon("Find a Workstation")}<input name="adminSearch" type="search" value="${escapeHtml(state.adminSearch)}" placeholder="${escapeHtml(placeholder)}" aria-label="Search administrator records" /></div></label>
    ${statuses ? `<label class="field"><span>Workstation status</span><select name="adminStatus"><option value="">All statuses</option>${["Available", "In use", "Idle", "Offline", "Maintenance", "Unknown"].map((status) => `<option value="${status}" ${state.adminStatus === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>` : ""}
    <button type="submit" class="primary-button">Apply filters</button>
    <button type="button" class="secondary-button" data-action="clear-admin-search">Clear</button>
  </form>`;
}

function recordTools() {
  return `<div class="record-tools"><span class="muted-copy">Expand a record for grouped details.</span><div><button type="button" class="secondary-button compact-button" data-action="toggle-details" data-expanded="true">Expand all</button><button type="button" class="secondary-button compact-button" data-action="toggle-details" data-expanded="false">Collapse all</button></div></div>`;
}

async function renderAdminPage() {
  if (state.page === "Profile") return renderProfilePage();
  if (state.page === "Settings") return renderSettingsPage();
  if (state.page === "Accounts") {
    const response = await api("/api/admin/users");
    return renderAccountsPage(response.users);
  }
  const [dashboard, response, alertResponse] = await Promise.all([
    api("/api/admin/dashboard"), api("/api/admin/workstations"), api("/api/admin/alerts")
  ]);
  const stations = response.workstations;
  if (state.page === "System details") {
    const selected = stations.find((item) => item.id === state.selectedWorkstationId);
    if (!selected) return emptyPanel("This workstation was not found. Return to the workstation list and choose another.");
    return renderWorkstationPage({ ...selected, allWorkstations: stations });
  }
  const query = state.adminSearch.toLocaleLowerCase();
  const filteredStations = stations.filter((item) => {
    const matchesStatus = !state.adminStatus || item.status === state.adminStatus;
    const searchable = [item.id, item.hostname, item.lab, item.room, item.os, ...item.software.map((software) => `${software.name} ${software.version} ${software.publisher}`)].join(" ").toLocaleLowerCase();
    return matchesStatus && (!query || searchable.includes(query));
  });
  const alerts = alertResponse.alerts.filter((item) => !item.resolvedAt);
  const overview = `<section class="panel"><div class="panel-header section-header"><div><p class="eyebrow">Current agent reports</p><h2>Workstation overview</h2></div><span class="demo-tag">Live API · reported data</span></div><div class="metric-row four-up">
    ${metricBox("Registered PCs", dashboard.total)}
    ${metricBox("Available", dashboard.counts.Available, "success")}
    ${metricBox("In use", dashboard.counts["In use"], "info")}
    ${metricBox("Idle", dashboard.counts.Idle, "warning")}
    ${metricBox("Offline", dashboard.counts.Offline, "danger")}
    ${metricBox("Maintenance", dashboard.counts.Maintenance, "neutral")}
    ${metricBox("Unknown status", dashboard.counts.Unknown, "neutral")}
    ${metricBox("Stale inventory", dashboard.staleInventory, "warning")}
  </div></section>`;

  if (state.page === "Overview") {
    const alertPage = pageItems(alerts, "alerts", 8);
    return `<div class="admin-view">${overview}<section class="panel admin-table-panel"><div class="panel-header"><div><p class="eyebrow">Workstation directory</p><h3>Latest device reports</h3></div></div>${adminSearchForm({ statuses: true })}${recordTools()}${adminWorkstationTable(filteredStations)}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">Open issues</p><h3>Alerts requiring attention</h3></div></div>${alertPage.items.length ? `${alertPage.controls}<div class="issue-list">${alertPage.items.map(alertCard).join("")}</div>` : emptyPanel("No unresolved agent alerts have been reported.")}</section></div>`;
  }
  if (state.page === "Workstations") {
    const workstationDraft = state.workstationDraft || {};
    return `<div class="admin-view">${overview}<section class="panel admin-table-panel"><div class="panel-header"><div><p class="eyebrow">Authorized devices</p><h3>Workstation management</h3></div></div><form id="register-workstation-form" class="register-device-form">
      ${field("Workstation ID", "id", "text", true, "", workstationDraft.id || "")}${field("Laboratory", "lab", "text", true, "", workstationDraft.lab || "")}${field("Room", "room", "text", false, "", workstationDraft.room || "")}<button class="primary-button" type="submit">Register workstation</button>
    </form>${state.agentCredential ? `<div class="credential-panel" role="status"><strong>Copy this agent credential now. It is shown only once.</strong><p>Workstation: ${escapeHtml(state.agentCredential.workstationId)}</p><code>${escapeHtml(state.agentCredential.agentToken)}</code><button type="button" class="secondary-button" data-action="copy-token">Copy token</button><p>Configure the authorized computer with this ID and token. Do not share it.</p></div>` : ""}
      ${adminSearchForm({ statuses: true })}${recordTools()}${adminWorkstationTable(filteredStations)}</section></div>`;
  }
  if (state.page === "Laboratories") {
    const labs = [...new Map(stations.map((item) => [item.lab, item])).values()];
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Laboratory assignments</p><h2>Registered laboratories</h2></div></div>${labs.length ? `<div class="lab-list">${labs.map((lab) => `<article class="lab-row"><div><h3>${escapeHtml(lab.lab)}</h3><p>${escapeHtml(lab.room || "Room not reported")}</p></div><span>${stations.filter((item) => item.lab === lab.lab).length} workstations</span></article>`).join("")}</div>` : emptyPanel("Laboratories appear when an administrator registers a workstation.")}</section>`;
  }
  if (state.page === "Software Inventory") {
    const records = filteredStations.flatMap((station) => station.software
      .filter((item) => !query || `${item.name} ${item.version} ${item.publisher} ${item.source}`.toLocaleLowerCase().includes(query) || `${station.id} ${station.lab}`.toLocaleLowerCase().includes(query))
      .map((item) => ({ ...item, workstation: station.id, lab: station.lab, freshness: station.inventoryFreshness, lastScan: station.lastInventoryScan })));
    const page = pageItems(records, "software records", 20);
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Agent-detected applications</p><h2>Software inventory</h2></div><span class="demo-tag">${records.length} detected records</span></div>${adminSearchForm({ placeholder: "Search application, publisher, workstation, or lab" })}${recordTools()}${records.length ? `${page.controls}<div class="inventory-list">${page.items.map((item) => `<article class="inventory-item structured-inventory-item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.version || "Version not reported")} · ${escapeHtml(item.workstation)}</span></div><div>${badge(item.freshness === "Fresh" ? "Available" : "Unknown")}</div><details class="structured-details"><summary>Record details</summary>${structuredFields([
      ["Version", item.version || "Not reported"], ["Publisher", item.publisher || "Not reported"],
      ["Workstation", item.workstation], ["Laboratory", item.lab],
      ["Inventory freshness", item.freshness], ["Last scan", formatDate(item.lastScan)],
      ["Last detected", formatDate(item.detected_at)], ["Detection source", item.source || "Not reported"]
    ])}</details></article>`).join("")}</div>` : emptyPanel("No software records match the selected filters.")}</section>`;
  }
  if (state.page === "System Health") {
    const page = pageItems(filteredStations, "health records");
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Latest telemetry only</p><h2>System health</h2></div></div>${adminSearchForm({ statuses: true })}${recordTools()}${page.items.length ? `${page.controls}<div class="table-wrap"><table><thead><tr><th>Workstation</th><th>Status</th><th>CPU</th><th>Memory</th><th>Disk</th><th>Network</th><th>Metric timestamp</th></tr></thead><tbody>${page.items.map((item) => `<tr><td><button type="button" class="table-link" data-action="open-workstation" data-id="${escapeHtml(item.id)}">${escapeHtml(item.id)}</button><span class="table-room">${escapeHtml(item.lab)}</span>${structuredWorkstationDetails(item)}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.health.cpuPercent == null ? "Not available" : `${item.health.cpuPercent}%`)}</td><td>${escapeHtml(item.health.memoryPercent == null ? "Not available" : `${item.health.memoryPercent}%`)}</td><td>${escapeHtml(item.health.diskPercent == null ? "Not available" : `${item.health.diskPercent}%`)}</td><td>${escapeHtml(item.health.network || "Not available")}</td><td>${escapeHtml(formatDate(item.health.reportedAt))}</td></tr>`).join("")}</tbody></table></div>` : emptyPanel("No workstation health records match the selected filters.")}</section>`;
  }
  if (state.page === "Alerts") {
    const matchedAlerts = alerts.filter((item) => !query || `${item.kind} ${item.message} ${item.workstationId}`.toLocaleLowerCase().includes(query));
    const page = pageItems(matchedAlerts, "alerts");
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Agent and operations alerts</p><h2>Alerts</h2></div></div>${adminSearchForm()}${page.items.length ? `${page.controls}<div class="issue-list">${page.items.map(alertCard).join("")}</div>` : emptyPanel("No unresolved alerts match the selected search.")}</section>`;
  }
  if (state.page === "Maintenance") {
    const affected = stations.filter((item) => item.status === "Maintenance");
    const page = pageItems(affected, "maintenance records");
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Authorized administrative action</p><h2>Maintenance workstations</h2></div></div>${page.items.length ? `${page.controls}<div class="issue-list">${page.items.map((item) => `<article class="issue-item"><div class="issue-heading"><strong>${escapeHtml(item.id)} · ${escapeHtml(item.lab)}</strong>${badge(item.status)}</div><p>${escapeHtml(item.maintenanceNote || "Maintenance state was set by an administrator.")}</p>${structuredWorkstationDetails(item)}<button class="secondary-button" type="button" data-action="toggle-maintenance" data-id="${escapeHtml(item.id)}" data-maintenance="true">Restore workstation</button></article>`).join("")}</div>` : emptyPanel("No workstations are currently marked for maintenance.")}</section>`;
  }
  if (state.page === "Reports") {
    const labs = [...new Set(stations.map((item) => item.lab))];
    const page = pageItems(labs, "laboratories");
    return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Current snapshot</p><h2>Operational report</h2></div></div><p class="data-note">Historical utilization is unavailable because the system has not yet recorded historical usage. This report contains current workstation and laboratory totals only.</p>${page.items.length ? `${page.controls}<div class="utilization-list">${page.items.map((lab) => { const entries = stations.filter((item) => item.lab === lab); const available = entries.filter((item) => item.status === "Available").length; return `<div class="lab-row"><strong>${escapeHtml(lab)}</strong><span>${available} available of ${entries.length} registered</span></div>`; }).join("")}</div>` : emptyPanel("No registered laboratory data is available.")}</section>`;
  }
  return overview;
}

function alertCard(item) {
  return `<article class="issue-item"><div class="issue-heading"><strong>${escapeHtml(item.kind)}</strong>${badge(item.kind === "offline" ? "Offline" : "Unknown")}</div><p>${escapeHtml(item.workstationId)} · ${escapeHtml(item.createdAt)}</p><small>${escapeHtml(item.message)}</small></article>`;
}

async function refresh({ preserveFocus = false } = {}) {
  if (routeSlug()) return;
  const sequence = ++state.refreshSequence;
  const focused = preserveFocus && document.activeElement instanceof HTMLElement
    ? {
      name: document.activeElement.getAttribute("name"),
      start: "selectionStart" in document.activeElement ? document.activeElement.selectionStart : null,
      end: "selectionEnd" in document.activeElement ? document.activeElement.selectionEnd : null
    }
    : null;
  const refreshButton = app.querySelector('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.setAttribute("aria-busy", "true");
    const label = refreshButton.querySelector("span");
    if (label) label.textContent = "Refreshing...";
  }
  const submitButton = document.activeElement?.form?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.dataset.originalLabel = submitButton.textContent;
    submitButton.textContent = "Searching...";
  }
  try {
    const content = state.user.role === "admin" ? await renderAdminPage() : await renderStudentPage();
    if (sequence !== state.refreshSequence) return;
    renderShell(content);
    if (focused?.name) {
      const input = [...app.querySelectorAll("[name]")].find((element) => element.getAttribute("name") === focused.name);
      if (input) {
        input.focus();
        if (focused.start !== null && typeof input.setSelectionRange === "function") {
          input.setSelectionRange(focused.start, focused.end);
        }
      }
    }
  } catch (error) {
    if (sequence !== state.refreshSequence) return;
    if (error.status === 401) {
      state.user = null;
      state.authMode = "login";
      state.error = "Your session ended. Sign in again to continue.";
      app.innerHTML = renderAuth();
      return;
    }
    state.error = error.message;
    renderShell(`<section class="panel"><div class="empty-state"><h3>Could not load this page</h3><p>${escapeHtml(error.message)} Check that the API server is running at ${escapeHtml(API_URL)}, then retry.</p><button type="button" class="primary-button" data-action="refresh">Retry</button></div></section>`);
  } finally {
    if (sequence === state.refreshSequence && refreshButton?.isConnected) {
      refreshButton.disabled = false;
      refreshButton.removeAttribute("aria-busy");
      const label = refreshButton.querySelector("span");
      if (label) label.textContent = "Refresh data";
    }
    if (sequence === state.refreshSequence && submitButton?.isConnected) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.textContent = submitButton.dataset.originalLabel || submitButton.textContent;
      delete submitButton.dataset.originalLabel;
    }
  }
}

function showAuth() {
  app.innerHTML = renderAuth();
}

async function loadSession() {
  if (renderRoutedPage()) return;
  try {
    const result = await api("/api/auth/me");
    state.user = result.user;
    if (state.user) {
      const workstationId = new URLSearchParams(location.search).get("workstation");
      state.returnPage = state.user.role === "admin" ? "Workstations" : "Dashboard";
      state.page = workstationId ? "System details" : state.returnPage;
      state.selectedWorkstationId = workstationId || "";
      await refresh();
    } else {
      showAuth();
    }
  } catch (error) {
    state.error = `Cannot connect to the API at ${API_URL}. Start the backend server, then reload this page.`;
    showAuth();
  }
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-page],[data-action],[data-auth-mode]");
  if (!target) return;
  if (target.dataset.authMode) {
    state.authMode = target.dataset.authMode;
    state.error = "";
    state.message = "";
    state.authDraft = {};
    state.authLoading = false;
    showAuth();
    return;
  }
  if (target.dataset.page) {
    state.page = target.dataset.page;
    const url = new URL(location.href);
    url.searchParams.delete("workstation");
    history.replaceState(null, "", url);
    state.listPages = {};
    state.error = "";
    state.message = "";
    state.profileEditing = false;
    state.profileDraft = null;
    state.resetCredential = null;
    state.workstationDraft = null;
    await refresh();
    return;
  }
  const action = target.dataset.action;
  if (action === "open-workstation") {
    state.returnPage = state.page === "System details" ? state.returnPage : state.page;
    state.selectedWorkstationId = target.dataset.id;
    state.workstationSoftwareSearch = "";
    state.page = "System details";
    const url = new URL(location.href);
    url.searchParams.set("workstation", state.selectedWorkstationId);
    history.pushState({ workstationDetail: true }, "", url);
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "back-to-workstations") {
    if (history.state?.workstationDetail) {
      history.back();
    } else {
      state.page = state.returnPage;
      state.selectedWorkstationId = "";
      state.workstationSoftwareSearch = "";
      const url = new URL(location.href);
      url.searchParams.delete("workstation");
      history.replaceState(null, "", url);
      await refresh();
    }
  } else if (action === "reveal-password") {
    const input = target.parentElement.querySelector("input");
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    target.textContent = showing ? "Hide" : "Show";
    target.setAttribute("aria-label", `${showing ? "Hide" : "Show"} password`);
  } else if (action === "refresh") {
    state.error = "";
    await refresh();
  } else if (action === "clear-student-filters") {
    state.search = "";
    state.lab = "";
    state.os = "";
    state.availability = "";
    state.listPages = {};
    await refresh();
  } else if (action === "clear-admin-search") {
    state.adminSearch = "";
    state.adminStatus = "";
    state.listPages = {};
    await refresh();
  } else if (action === "clear-workstation-search") {
    state.workstationSoftwareSearch = "";
    await refresh();
  } else if (action === "page-previous" || action === "page-next") {
    const scope = target.dataset.scope;
    if (!scope) return;
    state.listPages[scope] = Math.max(0, (state.listPages[scope] || 0) + (action === "page-next" ? 1 : -1));
    await refresh();
  } else if (action === "toggle-details") {
    const expanded = target.dataset.expanded === "true";
    app.querySelectorAll("#page-content details").forEach((details) => {
      details.open = expanded;
    });
    target.dataset.expanded = String(!expanded);
    target.textContent = expanded ? "Expand all" : "Collapse all";
  } else if (action === "logout") {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      state.error = "";
    } catch {
      state.error = "The server could not confirm sign out. Close this browser session and retry when the API is available.";
    }
    state.user = null;
    state.page = "Dashboard";
    state.authMode = "login";
    showAuth();
  } else if (action === "copy-token" && state.agentCredential) {
    try {
      await navigator.clipboard.writeText(state.agentCredential.agentToken);
      state.message = "Agent credential copied. Store it securely on the authorized workstation.";
      await refresh();
    } catch {
      state.error = "Clipboard access is unavailable. Copy the token from the visible credential field.";
      await refresh();
    }
  } else if (action === "rotate-agent-token") {
    if (!window.confirm(`Rotate the agent token for ${target.dataset.id}? The existing token will stop working immediately.`)) return;
    try {
      state.agentCredential = await api(`/api/admin/workstations/${encodeURIComponent(target.dataset.id)}/rotate-token`, {
        method: "POST",
        body: "{}"
      });
      state.message = `Agent token rotated for ${target.dataset.id}. Update the authorized workstation agent with the new token.`;
      state.error = "";
      state.page = "Workstations";
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
  } else if (action === "toggle-maintenance") {
    const entering = target.dataset.maintenance !== "true";
    if (!entering) {
      try {
        await api(`/api/admin/workstations/${encodeURIComponent(target.dataset.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ maintenance: false, note: "" })
        });
        state.error = "";
        state.message = "Workstation restored.";
        await refresh();
      } catch (error) {
        state.error = error.message;
        await refresh();
      }
      return;
    }
    openDialog({
      title: `Mark ${target.dataset.id} for maintenance?`,
      message: "The workstation will be reported as in maintenance until an administrator restores it.",
      confirmLabel: "Start maintenance",
      body: `<label class="field"><span>Describe the maintenance issue</span><input name="note" required maxlength="300" autocomplete="off" placeholder="e.g. Faulty power supply, sent for service" /></label>`,
      onSubmit: async (values) => {
        const note = String(values.note || "").trim();
        if (!note) throw new Error("Enter a short issue description before marking the workstation for maintenance.");
        await api(`/api/admin/workstations/${encodeURIComponent(target.dataset.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ maintenance: true, note })
        });
        state.error = "";
        state.message = "Workstation marked for maintenance.";
        await refresh();
      }
    });
  } else if (action === "toggle-nav") {
    const sidebar = app.querySelector(".sidebar");
    const open = Boolean(sidebar?.classList.toggle("open"));
    target.setAttribute("aria-expanded", String(open));
  } else if (action === "static-back") {
    history.pushState(null, "", `${location.pathname}${location.search}`);
    if (state.user) await refresh();
    else await loadSession();
  } else if (action === "edit-profile") {
    state.profileEditing = true;
    state.profileDraft = profileFieldValues();
    state.error = "";
    state.message = "";
    state.page = "Profile";
    await refresh();
  } else if (action === "cancel-profile") {
    state.profileEditing = false;
    state.profileDraft = null;
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "change-password") {
    state.page = "Profile";
    state.error = "";
    state.message = "Enter your current password and choose a new one below.";
    await refresh();
  } else if (action === "logout-all") {
    openDialog({
      title: "Sign out of all devices?",
      message: "You will be signed out everywhere, including this device, and will need to sign in again.",
      confirmLabel: "Sign out everywhere",
      onSubmit: async () => {
        await api("/api/auth/logout-all", { method: "POST", body: "{}" });
        state.user = null;
        state.page = "Dashboard";
        state.authMode = "login";
        state.error = "";
        state.message = "You have been signed out on all devices.";
        showAuth();
      }
    });
  } else if (action === "delete-account") {
    openDialog({
      title: "Delete your account?",
      message: "This permanently removes your account and cannot be undone.",
      consequences: [
        "Your profile, contact details, and all sessions are removed.",
        "You will be signed out immediately and must register again to return.",
        "Workstation, laboratory, software, and alert records are not affected."
      ],
      confirmLabel: "Delete account",
      danger: true,
      body: `<label class="field"><span>Type DELETE to confirm</span><input name="confirmation" required pattern="DELETE" autocomplete="off" placeholder="DELETE" /></label>
        <label class="field"><span>Your password</span><input name="password" type="password" required autocomplete="current-password" /></label>`,
      onSubmit: async (values) => {
        if (String(values.confirmation || "").trim().toUpperCase() !== "DELETE") throw new Error("Type DELETE exactly to confirm.");
        await api("/api/auth/account", { method: "DELETE", body: JSON.stringify({ password: values.password, confirmation: values.confirmation }) });
        state.user = null;
        state.page = "Dashboard";
        state.authMode = "login";
        state.profileEditing = false;
        state.profileDraft = null;
        state.error = "";
        state.message = "Your account has been deleted.";
        showAuth();
      }
    });
  } else if (action === "reset-settings") {
    openDialog({
      title: "Reset appearance settings?",
      message: "Your saved theme returns to the system default on this device.",
      confirmLabel: "Reset settings",
      onSubmit: async () => {
        try { localStorage.removeItem(THEME_KEY); } catch { /* storage unavailable */ }
        applyTheme();
        state.error = "";
        state.message = "Appearance settings reset to defaults.";
        await refresh();
      }
    });
  } else if (action === "issue-reset-code") {
    try {
      state.resetCredential = await api(`/api/admin/users/${encodeURIComponent(target.dataset.id)}/reset-code`, {
        method: "POST",
        body: "{}"
      });
      state.error = "";
      state.message = `Reset code issued for ${state.resetCredential.email}. It expires in ${state.resetCredential.expiresInMinutes} minutes.`;
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
  } else if (action === "copy-reset-code" && state.resetCredential) {
    try {
      await navigator.clipboard.writeText(state.resetCredential.code);
      state.error = "";
      state.message = "Reset code copied to the clipboard.";
      await refresh();
    } catch {
      state.error = "Clipboard access is unavailable. Copy the code from the credential field.";
      await refresh();
    }
  }
});

window.addEventListener("popstate", async () => {
  const workstationId = new URLSearchParams(location.search).get("workstation");
  if (workstationId) {
    state.selectedWorkstationId = workstationId;
    state.page = "System details";
  } else if (state.page === "System details") {
    state.page = state.returnPage;
    state.selectedWorkstationId = "";
    state.workstationSoftwareSearch = "";
  }
  await refresh();
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.formBusy) return;
  state.formBusy = true;
  try {
    await handleFormSubmit(event.target);
  } finally {
    state.formBusy = false;
  }
});

async function handleFormSubmit(form) {
  const formId = form.getAttribute("id");
  const values = Object.fromEntries(new FormData(form).entries());
  clearFieldErrors(form);
  state.error = "";
  state.message = "";

  if (formId === "auth-form") {
    const mode = state.authMode;
    const nonSecret = { ...values };
    delete nonSecret.password;
    delete nonSecret.confirmPassword;
    delete nonSecret.setupToken;
    delete nonSecret.code;
    state.authDraft = nonSecret;

    let invalid = null;
    if (mode === "login") {
      if (!String(values.identifier || "").trim()) invalid = ["identifier", "Enter your college email or registered ID."];
      else if (!String(values.password || "")) invalid = ["password", "Enter your password."];
    } else if (mode === "register") {
      if (!EMAIL_PATTERN.test(String(values.email || "").trim())) invalid = ["email", "Enter a valid college email address."];
      else if (!String(values.name || "").trim()) invalid = ["name", "Enter your full name."];
      else if (!String(values.usn || "").trim()) invalid = ["usn", "Enter your USN or registration number."];
      else if (String(values.phone || "").replace(/\D/g, "").length < 7) invalid = ["phone", "Enter a valid phone number (at least 7 digits)."];
      else if (!String(values.department || "").trim()) invalid = ["department", "Enter your department and branch."];
      else if (!String(values.semester || "").trim()) invalid = ["semester", "Enter your semester."];
      else if (!String(values.section || "").trim()) invalid = ["section", "Enter your section."];
      else if (passwordPolicyError(values.password)) invalid = ["password", passwordPolicyError(values.password)];
      else if (values.password !== values.confirmPassword) invalid = ["confirmPassword", "The passwords do not match."];
    } else if (mode === "setup") {
      if (!EMAIL_PATTERN.test(String(values.email || "").trim())) invalid = ["email", "Enter a valid email address."];
      else if (!String(values.name || "").trim()) invalid = ["name", "Enter the administrator's full name."];
      else if (!String(values.employeeId || "").trim()) invalid = ["employeeId", "Enter the employee ID."];
      else if (!String(values.department || "").trim()) invalid = ["department", "Enter the department."];
      else if (!String(values.setupToken || "").trim()) invalid = ["setupToken", "Enter the one-time administrator setup token."];
      else if (passwordPolicyError(values.password)) invalid = ["password", passwordPolicyError(values.password)];
      else if (values.password !== values.confirmPassword) invalid = ["confirmPassword", "The passwords do not match."];
    } else if (mode === "forgot") {
      if (!EMAIL_PATTERN.test(String(values.email || "").trim())) invalid = ["email", "Enter a valid email address."];
      else if (!String(values.code || "").trim()) invalid = ["code", "Enter the one-time code from your administrator."];
      else if (passwordPolicyError(values.password)) invalid = ["password", passwordPolicyError(values.password)];
      else if (values.password !== values.confirmPassword) invalid = ["confirmPassword", "The passwords do not match."];
    }
    if (invalid) {
      injectFieldError(form, invalid[0], invalid[1]);
      return;
    }

    state.authLoading = true;
    showAuth();
    try {
      if (mode === "forgot") {
        await api("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            email: String(values.email || "").trim(),
            code: String(values.code || "").trim(),
            password: values.password,
            confirmPassword: values.confirmPassword
          })
        });
        state.authLoading = false;
        state.authDraft = {};
        state.authMode = "login";
        state.error = "";
        state.message = "Password updated. Sign in with your new password.";
        showAuth();
        return;
      }
      const path = mode === "register" ? "/api/auth/register" : mode === "setup" ? "/api/auth/setup-admin" : "/api/auth/login";
      const body = mode === "login"
        ? { identifier: values.identifier, password: values.password }
        : mode === "register"
          ? { name: values.name, email: values.email, usn: values.usn, phone: values.phone, department: values.department, semester: values.semester, section: values.section, password: values.password, confirmPassword: values.confirmPassword }
          : { name: values.name, email: values.email, employeeId: values.employeeId, department: values.department, setupToken: values.setupToken, password: values.password, confirmPassword: values.confirmPassword };
      const result = await api(path, { method: "POST", body: JSON.stringify(body) });
      state.user = result.user;
      state.page = result.user.role === "admin" ? "Overview" : "Dashboard";
      state.authLoading = false;
      state.error = "";
      state.authDraft = {};
      await refresh();
    } catch (error) {
      state.authLoading = false;
      state.error = error.message;
      showAuth();
    }
    return;
  }

  if (formId === "student-search-form") {
    state.search = String(values.software || "").trim();
    state.lab = values.lab;
    state.os = values.os;
    state.availability = values.availability;
    state.listPages = {};
    await refresh({ preserveFocus: true });
    return;
  }

  if (formId === "admin-search-form") {
    state.adminSearch = String(values.adminSearch || "").trim();
    state.adminStatus = values.adminStatus || "";
    state.listPages = {};
    await refresh({ preserveFocus: true });
    return;
  }

  if (formId === "workstation-software-search") {
    state.workstationSoftwareSearch = String(values.softwareSearch || "").trim();
    await refresh({ preserveFocus: true });
    return;
  }

  if (formId === "profile-form") {
    const draft = {
      name: String(values.name || "").trim(),
      phone: String(values.phone || "").trim(),
      department: String(values.department || "").trim(),
      semester: String(values.semester || "").trim(),
      section: String(values.section || "").trim()
    };
    state.profileDraft = draft;
    let invalid = null;
    if (!draft.name) invalid = ["name", "Enter your full name."];
    const digits = draft.phone.replace(/\D/g, "");
    if (!invalid && (digits.length < 7 || digits.length > 15)) invalid = ["phone", "Enter a valid phone number (7 to 15 digits)."];
    if (!invalid && state.user?.role === "student" && !draft.department) invalid = ["department", "Enter your department and branch."];
    if (!invalid && state.user?.role === "student" && !draft.semester) invalid = ["semester", "Enter your semester."];
    if (!invalid && state.user?.role === "student" && !draft.section) invalid = ["section", "Enter your section."];
    if (invalid) {
      injectFieldError(form, invalid[0], invalid[1]);
      return;
    }
    try {
      const result = await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify(draft) });
      state.user = result.user;
      state.profileEditing = false;
      state.profileDraft = null;
      state.error = "";
      state.message = "Profile changes saved.";
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
    return;
  }

  if (formId === "change-password-form") {
    let invalid = null;
    if (!String(values.currentPassword || "")) invalid = ["currentPassword", "Enter your current password."];
    const policy = passwordPolicyError(values.newPassword);
    if (!invalid && policy) invalid = ["newPassword", policy];
    if (!invalid && values.newPassword !== values.confirmPassword) invalid = ["confirmPassword", "The passwords do not match."];
    if (!invalid && values.newPassword === values.currentPassword) invalid = ["newPassword", "Choose a password different from your current one."];
    if (invalid) {
      injectFieldError(form, invalid[0], invalid[1]);
      return;
    }
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword, confirmPassword: values.confirmPassword })
      });
      state.error = "";
      state.message = "Password updated. Other devices were signed out.";
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
    return;
  }

  if (formId === "register-workstation-form") {
    const draft = {
      id: String(values.id || "").trim().toUpperCase(),
      lab: String(values.lab || "").trim(),
      room: String(values.room || "").trim()
    };
    state.workstationDraft = draft;
    let invalid = null;
    if (!/^[A-Z0-9-]{2,32}$/.test(draft.id)) invalid = ["id", "Use 2 to 32 letters, numbers, or hyphens for the workstation ID."];
    else if (!draft.lab) invalid = ["lab", "Enter the laboratory name."];
    if (invalid) {
      injectFieldError(form, invalid[0], invalid[1]);
      return;
    }
    try {
      state.agentCredential = await api("/api/admin/workstations", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      state.workstationDraft = null;
      state.message = "Workstation registered. Copy the credential now and configure its authorized agent.";
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
  }
}

app.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "search") return;
  const form = input.form;
  if (!form || !["student-search-form", "admin-search-form", "workstation-software-search"].includes(form.id)) return;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    if (form.isConnected) form.requestSubmit();
  }, 300);
});

app.addEventListener("change", (event) => {
  const select = event.target;
  if (select instanceof HTMLInputElement && select.type === "radio" && select.name === "theme") {
    setThemePreference(select.value);
    state.error = "";
    state.message = `Theme set to ${select.value === "system" ? "system default" : `${select.value} mode`}.`;
    refresh();
    return;
  }
  if (!(select instanceof HTMLSelectElement) || !select.form) return;
  if (["student-search-form", "admin-search-form"].includes(select.form.id)) {
    select.form.requestSubmit();
  }
});

window.addEventListener("hashchange", async () => {
  if (renderRoutedPage()) return;
  if (state.user) await refresh();
  else await loadSession();
});

loadSession();
