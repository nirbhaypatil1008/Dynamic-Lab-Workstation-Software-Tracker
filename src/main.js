import "./style.css";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:3001")).replace(/\/$/, "");
const app = document.querySelector("#app");

let enrollmentPollTimer = null;

function stopEnrollmentPolling() {
  if (enrollmentPollTimer) {
    clearInterval(enrollmentPollTimer);
    enrollmentPollTimer = null;
  }
}

function startEnrollmentPolling(enrollmentId) {
  stopEnrollmentPolling();
  enrollmentPollTimer = setInterval(async () => {
    if (!state.activeEnrollment || state.activeEnrollment.enrollmentId !== enrollmentId) {
      stopEnrollmentPolling();
      return;
    }
    try {
      const statusRes = await api(`/api/admin/enrollment/${encodeURIComponent(enrollmentId)}/status`);
      if (state.activeEnrollment && state.activeEnrollment.enrollmentId === enrollmentId) {
        const prevStatus = state.activeEnrollment.status;
        state.activeEnrollment.status = statusRes.status;
        state.activeEnrollment.progressMessage = statusRes.progressMessage;
        state.activeEnrollment.errorMessage = statusRes.errorMessage;
        state.activeEnrollment.targetHostname = statusRes.targetHostname;
        state.activeEnrollment.targetIp = statusRes.targetIp;

        if (statusRes.status === "completed" || statusRes.status === "expired" || statusRes.status === "revoked" || statusRes.status === "failed") {
          stopEnrollmentPolling();
          if (statusRes.status === "completed" && prevStatus !== "completed") {
            state.message = `Workstation ${statusRes.workstationId} successfully connected and active!`;
          }
        }
        await refresh({ preserveFocus: true });
      }
    } catch {
      // Ignore polling transient errors
    }
  }, 2500);
}

const state = {
  user: null,
  authMode: "login",
  page: "Dashboard",
  returnPage: "Dashboard",
  selectedWorkstationId: "",
  selectedLabName: "",
  viewMode: "grid",
  sortBy: "id-asc",
  workstationSoftwareSearch: "",
  labSearch: "",
  error: "",
  message: "",
  search: "",
  adminSearch: "",
  adminStatus: "",
  lab: "",
  os: "",
  availability: "",
  agentCredential: null,
  activeEnrollment: null,
  enrollmentCopied: false,
  showManualSetup: false,
  resetCredential: null,
  authLoading: false,
  listPages: {},
  refreshSequence: 0,
  profileEditing: false,
  profileDraft: null,
  authDraft: {},
  workstationDraft: null,
  formBusy: false,
  apiLatency: 12,
  activeCategory: "All Workstations",
  userMenuOpen: false,
  favorites: (() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("lab-favorites") || "[]"));
    } catch {
      return new Set();
    }
  })()
};

const studentPages = ["Dashboard", "Find a Workstation", "Laboratories", "Profile", "Settings"];
const adminPages = ["Overview", "Workstations", "Laboratories", "Software Inventory", "System Health", "Alerts", "Maintenance", "Reports", "Accounts", "Profile", "Settings"];
const pageSubtitles = {
  Dashboard: "Real-time laboratory ecosystem overview, capacity intelligence, and quick discovery actions.",
  "Find a Workstation": "Search computer specifications, installed software, and real-time availability before visiting a lab.",
  Laboratories: "Explore laboratory facilities, room configurations, and hardware allocations.",
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
    "Refresh data": '<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"></path>',
    CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    UserCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline>',
    PowerOff: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line>',
    Server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>',
    Grid: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    List: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
    Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    Cpu: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>',
    ArrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    Filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    Clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    Search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    X: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    Sun: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
    Moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
    Heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
    HeartFilled: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#FF385C" stroke="#FF385C"></path>',
    Code: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
    DatabaseIcon: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
    ShieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path>',
    Palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"></path>',
    NetworkIcon: '<rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"></path>',
    Sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>'
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
  const displayName = state.user.name || state.user.email;
  const initial = (displayName[0] || "S").toUpperCase();
  const isDark = themePreference() === "dark" || (themePreference() === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const isStudent = state.user.role === "student";

  app.innerHTML = `
    <div class="airbnb-app-layout">
      <!-- Sticky Desktop & Tablet Header -->
      <header class="airbnb-header">
        <div class="airbnb-header-inner">
          <!-- Left: Logo & Brand -->
          <a href="#/dashboard" class="airbnb-brand" data-page="Dashboard" aria-label="Dynamic Lab Home">
            <img class="airbnb-logo" src="/lab-logo.png" alt="Dynamic Lab logo" />
            <div class="airbnb-brand-text">
              <span class="airbnb-brand-title">Dynamic Lab</span>
              <span class="airbnb-brand-subtitle">Workstation Tracker</span>
            </div>
          </a>

          <!-- Center: Airbnb Pill Navigation -->
          <nav class="airbnb-center-nav" aria-label="Main navigation">
            <button type="button" class="airbnb-nav-pill ${state.page === "Dashboard" ? "active" : ""}" data-page="Dashboard" ${state.page === "Dashboard" ? 'aria-current="page"' : ""}>
              ${icon("Dashboard")}
              <span>Dashboard</span>
            </button>
            <button type="button" class="airbnb-nav-pill ${state.page === "Find a Workstation" ? "active" : ""}" data-page="Find a Workstation" ${state.page === "Find a Workstation" ? 'aria-current="page"' : ""}>
              ${icon("Find a Workstation")}
              <span>Find Workstations</span>
            </button>
            <button type="button" class="airbnb-nav-pill ${state.page === "Laboratories" ? "active" : ""}" data-page="Laboratories" ${state.page === "Laboratories" ? 'aria-current="page"' : ""}>
              ${icon("Laboratories")}
              <span>Laboratories</span>
            </button>
            ${!isStudent ? `
              <button type="button" class="airbnb-nav-pill ${adminPages.includes(state.page) && !["Dashboard", "Find a Workstation", "Laboratories", "Profile", "Settings"].includes(state.page) ? "active" : ""}" data-page="Overview">
                ${icon("Server")}
                <span>Admin Hub</span>
              </button>
            ` : ""}
          </nav>

          <!-- Right: Theme Switcher, Telemetry Refresh & User Capsule -->
          <div class="airbnb-right-actions">
            <button type="button" class="airbnb-icon-btn" data-action="toggle-theme" title="Switch theme (${isDark ? "Dark" : "Light"})" aria-label="Toggle theme">
              ${icon(isDark ? "Sun" : "Moon")}
            </button>
            <button type="button" class="airbnb-icon-btn" data-action="refresh" title="Refresh live telemetry" aria-label="Refresh telemetry">
              ${icon("Refresh data")}
            </button>
            
            <div class="airbnb-user-menu-wrapper">
              <button type="button" class="airbnb-user-capsule" data-action="toggle-user-dropdown" aria-haspopup="true" aria-expanded="${state.userMenuOpen ? "true" : "false"}" aria-label="User account menu">
                <span class="airbnb-hamburger-lines">${icon("Menu")}</span>
                <div class="airbnb-avatar-circle">${escapeHtml(initial)}</div>
                <span class="airbnb-user-firstname">${escapeHtml(state.user.name ? state.user.name.split(" ")[0] : "Student")}</span>
              </button>

              ${state.userMenuOpen ? `
                <div class="airbnb-dropdown-menu" id="user-dropdown-menu" role="menu">
                  <div class="dropdown-header">
                    <strong>${escapeHtml(displayName)}</strong>
                    <span class="dropdown-role-badge">${escapeHtml(state.user.role)} ${state.user.department ? `· ${escapeHtml(state.user.department)}` : ""}</span>
                    ${state.user.identifier ? `<span class="dropdown-usn">USN / ID: ${escapeHtml(state.user.identifier)}</span>` : ""}
                  </div>
                  <div class="dropdown-divider"></div>
                  
                  <button type="button" class="dropdown-item" data-page="Dashboard">
                    ${icon("Dashboard")} <span>Dashboard Explore</span>
                  </button>
                  <button type="button" class="dropdown-item" data-page="Find a Workstation">
                    ${icon("Find a Workstation")} <span>Find a Workstation</span>
                  </button>
                  <button type="button" class="dropdown-item" data-page="Laboratories">
                    ${icon("Laboratories")} <span>Explore Laboratories</span>
                  </button>
                  <button type="button" class="dropdown-item" data-page="Profile">
                    ${icon("Profile")} <span>My Profile</span>
                  </button>
                  <button type="button" class="dropdown-item" data-page="Settings">
                    ${icon("Settings")} <span>Settings & Appearance</span>
                  </button>

                  ${!isStudent ? `
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-section-title">Admin Management</div>
                    <button type="button" class="dropdown-item" data-page="Overview">${icon("Overview")} <span>Overview</span></button>
                    <button type="button" class="dropdown-item" data-page="Workstations">${icon("Workstations")} <span>Workstation Fleet</span></button>
                    <button type="button" class="dropdown-item" data-page="Accounts">${icon("Accounts")} <span>Account Manager</span></button>
                    <button type="button" class="dropdown-item" data-page="Software Inventory">${icon("Software Inventory")} <span>Software Catalog</span></button>
                    <button type="button" class="dropdown-item" data-page="System Health">${icon("System Health")} <span>System Health</span></button>
                    <button type="button" class="dropdown-item" data-page="Alerts">${icon("Alerts")} <span>Alerts & Telemetry</span></button>
                    <button type="button" class="dropdown-item" data-page="Reports">${icon("Reports")} <span>Operational Reports</span></button>
                  ` : ""}

                  <div class="dropdown-divider"></div>
                  <button type="button" class="dropdown-item text-danger" data-action="logout">
                    ${icon("Sign out")} <span>Sign out</span>
                  </button>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="airbnb-main-content">
        ${state.error ? `<div class="notice error-notice" role="alert">${escapeHtml(state.error)}</div>` : ""}
        ${state.message ? `<div class="notice success-notice" role="status">${escapeHtml(state.message)}</div>` : ""}
        <div id="page-content">${content}</div>
        ${footer()}
      </main>

      <!-- Fixed Touch-Friendly Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button type="button" class="mobile-nav-btn ${state.page === "Dashboard" ? "active" : ""}" data-page="Dashboard">
          ${icon("Dashboard")}
          <span>Explore</span>
        </button>
        <button type="button" class="mobile-nav-btn ${state.page === "Find a Workstation" ? "active" : ""}" data-page="Find a Workstation">
          ${icon("Find a Workstation")}
          <span>Discover</span>
        </button>
        <button type="button" class="mobile-nav-btn ${state.page === "Laboratories" ? "active" : ""}" data-page="Laboratories">
          ${icon("Laboratories")}
          <span>Labs</span>
        </button>
        <button type="button" class="mobile-nav-btn ${state.page === "Profile" ? "active" : ""}" data-page="Profile">
          ${icon("Profile")}
          <span>Profile</span>
        </button>
      </nav>
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
  return `<dl class="structured-fields">${fields.map(([label, value]) => {
    const displayValue = (value !== null && value !== undefined && String(value).trim() !== "")
      ? String(value)
      : "Not reported";
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue)}</dd></div>`;
  }).join("")}</dl>`;
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
        ["Laboratory", item.lab], ["Room", item.room], ["Status", item.status],
        ["IP Address", item.ipAddress || "Not reported"], ["Agent Version", item.agentVersion || "1.0.0"]
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
        <div class="hero-status-group">
          ${item.revoked || item.status === "Revoked" ? `<span class="badge danger">Revoked</span>` : badge(item.status)}
          ${state.user?.role === "admin" ? `
            <div class="hero-admin-actions">
              <button type="button" class="secondary-button compact-button" data-action="reconnect-workstation" data-id="${escapeHtml(item.id)}" title="Generate 1-command installer">⚡ Reconnect</button>
              ${!item.revoked && item.status !== "Revoked" ? `<button type="button" class="secondary-button compact-button danger-button-text" data-action="revoke-workstation" data-id="${escapeHtml(item.id)}">Revoke Access</button>` : ""}
              <button type="button" class="secondary-button compact-button delete-pc-btn" data-action="delete-workstation" data-id="${escapeHtml(item.id)}" title="Permanently delete this registered workstation">Delete Workstation</button>
            </div>
          ` : ""}
        </div>
      </div>
      <p class="data-note">${item.inventoryFreshness === "Fresh" ? "Inventory is recently reported by the authorized agent." : "The inventory is stale or missing. Treat this software list as last reported information, not confirmation of current installation."}</p>
    </section>
    <section class="panel">
      <div class="panel-header"><div><p class="eyebrow">Structured system information</p><h3>Workstation details</h3></div></div>
      <div class="system-detail-sections">
        <section><h4>Identification and assignment</h4>${structuredFields([
          ["Workstation ID", item.id], ["Hostname", item.hostname], ["Laboratory", item.lab], ["Room", item.room], ["Status", item.status],
          ["IP Address", item.ipAddress || "Not reported"], ["Agent Version", item.agentVersion || "1.0.0"]
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

/* ---------------- Helpers for Redesigned Student Portal (Airbnb Pattern) ---------------- */

function timeAgo(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (Number.isNaN(diffSec) || diffSec < 0) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function categorizeSoftware(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("python") || n.includes("java") || n.includes("node") || n.includes("c++") || n.includes("gcc") || n.includes("rust") || n.includes("go") || n.includes("sdk")) return "Dev";
  if (n.includes("mongo") || n.includes("sql") || n.includes("db") || n.includes("postgres") || n.includes("redis")) return "Database";
  if (n.includes("code") || n.includes("studio") || n.includes("intellij") || n.includes("pycharm") || n.includes("eclipse")) return "IDE";
  if (n.includes("wireshark") || n.includes("nmap") || n.includes("packet") || n.includes("security") || n.includes("burp") || n.includes("ssh")) return "Security";
  if (n.includes("git") || n.includes("docker") || n.includes("postman") || n.includes("terminal")) return "Tools";
  if (n.includes("office") || n.includes("word") || n.includes("excel") || n.includes("chrome") || n.includes("pdf")) return "Productivity";
  return "System";
}

function matchesCategory(ws, category) {
  if (!category || category === "All Workstations") return true;
  if (category === "Available Now") return ws.status === "Available";
  const soft = (ws.software || []).map((s) => (s.name || "").toLowerCase()).join(" ");
  const lab = (ws.lab || "").toLowerCase();

  if (category === "Programming") {
    return /python|java|c\+\+|gcc|rust|golang|node|sdk|ruby|php|clang|visual studio|vs code|intellij|eclipse|pycharm/i.test(soft) || lab.includes("programming");
  }
  if (category === "Cybersecurity") {
    return /wireshark|nmap|burp|metasploit|snort|kali|security|packet|hashcat|hydra|aircrack|cisco/i.test(soft) || lab.includes("cyber") || lab.includes("security");
  }
  if (category === "Database") {
    return /mongo|sql|postgres|redis|db|mariadb|sqlite|oracle|cassandra|dbeaver|compass/i.test(soft) || lab.includes("database");
  }
  if (category === "AI & Machine Learning") {
    return /python|pytorch|tensorflow|cuda|anaconda|jupyter|scikit|pandas|numpy|keras|opencv/i.test(soft) || lab.includes("ai") || lab.includes("ml") || lab.includes("intelligence");
  }
  if (category === "Web Development") {
    return /node|npm|react|vue|angular|postman|nginx|apache|html|css|javascript|typescript|chrome|firefox|yarn/i.test(soft) || lab.includes("web");
  }
  if (category === "Design Tools") {
    return /figma|blender|photoshop|gimp|illustrator|inkscape|cad|autocad|maya|sketch/i.test(soft) || lab.includes("multimedia") || lab.includes("design");
  }
  if (category === "Networking") {
    return /wireshark|packet tracer|putty|ssh|telnet|cisco|gns3|ns3|tcpdump|nmap/i.test(soft) || lab.includes("network");
  }
  return true;
}

function svgWorkstationIllustration(ws = {}) {
  const status = ws.status || "Unknown";
  const glowColor = status === "Available" ? "#10B981" :
                    status === "In use" ? "#0284C7" :
                    status === "Idle" ? "#F59E0B" :
                    status === "Maintenance" ? "#8B5CF6" : "#64748B";
  const safeId = (ws.id || "ws").replace(/[^a-zA-Z0-9]/g, "-");
  const bgGradId = `ws-bg-${safeId}`;
  const screenGradId = `scr-${safeId}`;
  const isAvailable = status === "Available";

  return `
    <svg class="airbnb-listing-illustration" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${bgGradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1A2332" />
          <stop offset="100%" stop-color="#0E141E" />
        </linearGradient>
        <linearGradient id="${screenGradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="100%" stop-color="#1E293B" />
        </linearGradient>
        <filter id="glow-${safeId}" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Background Wall & Room -->
      <rect width="320" height="200" fill="url(#${bgGradId})" />
      
      <!-- Subtle Lab Ambient Grid -->
      <g opacity="0.07" stroke="#94A3B8" stroke-width="1">
        <line x1="0" y1="40" x2="320" y2="40" />
        <line x1="0" y1="80" x2="320" y2="80" />
        <line x1="0" y1="120" x2="320" y2="120" />
        <line x1="80" y1="0" x2="80" y2="160" />
        <line x1="160" y1="0" x2="160" y2="160" />
        <line x1="240" y1="0" x2="240" y2="160" />
      </g>
      
      <!-- Monitor Ambient Backlight Glow -->
      <ellipse cx="160" cy="85" rx="85" ry="50" fill="${glowColor}" opacity="0.22" filter="url(#glow-${safeId})" />

      <!-- Modern Desk Surface -->
      <polygon points="20,158 300,158 320,200 0,200" fill="#243042" />
      <line x1="0" y1="158" x2="320" y2="158" stroke="#334155" stroke-width="2" />
      <line x1="0" y1="162" x2="320" y2="162" stroke="${glowColor}" stroke-width="1" opacity="0.3" />

      <!-- Monitor Stand -->
      <path d="M152 135 L168 135 L164 162 L156 162 Z" fill="#475569" />
      <ellipse cx="160" cy="163" rx="26" ry="4" fill="#334155" stroke="#475569" stroke-width="1" />

      <!-- Monitor Outer Frame -->
      <rect x="75" y="32" width="170" height="106" rx="6" fill="#0B0F17" stroke="#334155" stroke-width="2" />

      <!-- Monitor Screen Panel -->
      <rect x="80" y="37" width="160" height="96" rx="3" fill="url(#${screenGradId})" />

      <!-- Screen UI Content (Code / Terminal / Status Glow) -->
      ${isAvailable ? `
        <g opacity="0.9">
          <circle cx="90" cy="46" r="2.5" fill="#EF4444" />
          <circle cx="98" cy="46" r="2.5" fill="#F59E0B" />
          <circle cx="106" cy="46" r="2.5" fill="#10B981" />
          <line x1="88" y1="56" x2="135" y2="56" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" />
          <line x1="88" y1="66" x2="185" y2="66" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" opacity="0.75" />
          <line x1="88" y1="74" x2="155" y2="74" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" opacity="0.5" />
          <line x1="88" y1="82" x2="215" y2="82" stroke="#A78BFA" stroke-width="1.8" stroke-linecap="round" opacity="0.6" />
          <line x1="88" y1="90" x2="140" y2="90" stroke="#10B981" stroke-width="1.8" stroke-linecap="round" opacity="0.8" />
          <rect x="88" y="100" width="8" height="12" fill="#10B981" opacity="0.8" />
          <text x="100" y="110" font-family="monospace" font-size="8" fill="#10B981" font-weight="bold">ONLINE</text>
        </g>
      ` : status === "In use" ? `
        <g opacity="0.9">
          <rect x="84" y="42" width="28" height="86" fill="#0D1117" opacity="0.6" />
          <line x1="90" y1="50" x2="104" y2="50" stroke="#38BDF8" stroke-width="1.5" />
          <line x1="90" y1="56" x2="108" y2="56" stroke="#94A3B8" stroke-width="1.5" />
          <line x1="90" y1="62" x2="102" y2="62" stroke="#94A3B8" stroke-width="1.5" />
          <line x1="120" y1="52" x2="180" y2="52" stroke="#F472B6" stroke-width="2" stroke-linecap="round" />
          <line x1="120" y1="62" x2="220" y2="62" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" />
          <line x1="130" y1="72" x2="195" y2="72" stroke="#34D399" stroke-width="1.8" stroke-linecap="round" />
          <line x1="130" y1="82" x2="205" y2="82" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round" />
          <line x1="120" y1="92" x2="160" y2="92" stroke="#818CF8" stroke-width="2" stroke-linecap="round" />
          <text x="175" y="118" font-family="sans-serif" font-size="8" fill="#38BDF8" font-weight="600">IN USE</text>
        </g>
      ` : `
        <g opacity="0.4" text-anchor="middle">
          <circle cx="160" cy="80" r="14" fill="none" stroke="#64748B" stroke-width="2" />
          <line x1="160" y1="72" x2="160" y2="82" stroke="#64748B" stroke-width="2" stroke-linecap="round" />
          <text x="160" y="110" font-family="sans-serif" font-size="8" fill="#64748B">STANDBY</text>
        </g>
      `}

      <!-- Slim Modern Keyboard -->
      <rect x="110" y="168" width="100" height="18" rx="3" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <g opacity="0.3" fill="#64748B">
        <rect x="115" y="171" width="10" height="4" rx="1" />
        <rect x="128" y="171" width="10" height="4" rx="1" />
        <rect x="141" y="171" width="10" height="4" rx="1" />
        <rect x="154" y="171" width="10" height="4" rx="1" />
        <rect x="167" y="171" width="10" height="4" rx="1" />
        <rect x="180" y="171" width="10" height="4" rx="1" />
        <rect x="193" y="171" width="12" height="4" rx="1" />
        <rect x="135" y="179" width="50" height="4" rx="1" />
      </g>

      <!-- Ergonomic Mouse -->
      <rect x="225" y="170" width="14" height="20" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <line x1="232" y1="171" x2="232" y2="178" stroke="#475569" stroke-width="1" />
      
      <!-- Tower Case Silhouette on Right -->
      <rect x="260" y="80" width="36" height="85" rx="3" fill="#111827" stroke="#1F2937" stroke-width="1.5" />
      <circle cx="278" cy="95" r="3" fill="${glowColor}" opacity="0.9" />
      <line x1="268" y1="110" x2="288" y2="110" stroke="#374151" stroke-width="1.5" />
      <line x1="268" y1="116" x2="288" y2="116" stroke="#374151" stroke-width="1.5" />
    </svg>
  `;
}

function svgLabIllustration(labName = "") {
  const isCyber = /cyber|security/i.test(labName);
  const isProg = /program|code|dev/i.test(labName);
  const isAi = /ai|ml|intelligence|data/i.test(labName);
  const accent = isCyber ? "#10B981" : isAi ? "#8B5CF6" : isProg ? "#0284C7" : "#F59E0B";
  const safeName = (labName || "lab").replace(/[^a-zA-Z0-9]/g, "-");

  return `
    <svg class="airbnb-lab-illustration" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="labgrad-${safeName}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E293B" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#labgrad-${safeName})" />
      
      <!-- Floor -->
      <polygon points="0,110 320,110 320,180 0,180" fill="#182234" opacity="0.9" />
      <line x1="0" y1="110" x2="320" y2="110" stroke="#334155" stroke-width="2" />
      
      <!-- Server Rack -->
      <rect x="25" y="30" width="36" height="85" rx="3" fill="#0B0F19" stroke="#334155" stroke-width="1.5" />
      <line x1="30" y1="42" x2="56" y2="42" stroke="${accent}" stroke-width="2" opacity="0.8" />
      <line x1="30" y1="52" x2="56" y2="52" stroke="#38BDF8" stroke-width="2" opacity="0.7" />
      <line x1="30" y1="62" x2="56" y2="62" stroke="#94A3B8" stroke-width="1.5" opacity="0.6" />
      <line x1="30" y1="72" x2="56" y2="72" stroke="${accent}" stroke-width="2" opacity="0.8" />
      <circle cx="34" cy="85" r="2" fill="${accent}" />
      <circle cx="42" cy="85" r="2" fill="#38BDF8" />
      <circle cx="50" cy="85" r="2" fill="#F59E0B" />

      <!-- Row of Computer Workstations -->
      <rect x="85" y="65" width="45" height="30" rx="3" fill="#0F172A" stroke="#38BDF8" stroke-width="1.5" />
      <rect x="88" y="68" width="39" height="24" rx="2" fill="#1E293B" />
      <line x1="92" y1="76" x2="115" y2="76" stroke="${accent}" stroke-width="1.5" />
      <polygon points="80,115 140,115 145,135 75,135" fill="#243042" />

      <rect x="160" y="60" width="55" height="36" rx="3" fill="#0F172A" stroke="${accent}" stroke-width="1.8" />
      <rect x="164" y="64" width="47" height="28" rx="2" fill="#1E293B" />
      <line x1="170" y1="74" x2="200" y2="74" stroke="${accent}" stroke-width="2" />
      <line x1="170" y1="80" x2="195" y2="80" stroke="#38BDF8" stroke-width="1.5" />
      <polygon points="150,115 225,115 235,140 140,140" fill="#243042" />

      <rect x="245" y="65" width="45" height="30" rx="3" fill="#0F172A" stroke="#818CF8" stroke-width="1.5" />
      <rect x="248" y="68" width="39" height="24" rx="2" fill="#1E293B" />
      <line x1="252" y1="76" x2="278" y2="76" stroke="#818CF8" stroke-width="1.5" />
      <polygon points="235,115 295,115 305,135 225,135" fill="#243042" />

      <!-- Ceiling Light Tracks -->
      <line x1="70" y1="10" x2="270" y2="10" stroke="#E2E8F0" stroke-width="3" opacity="0.3" stroke-linecap="round" />
      <line x1="100" y1="20" x2="240" y2="20" stroke="${accent}" stroke-width="1" opacity="0.4" />
    </svg>
  `;
}

function renderDonutChart(counts, total) {
  if (!total) {
    return `<div class="donut-chart-container" style="display:flex;align-items:center;justify-content:center;"><span style="color:var(--muted);font-size:0.8rem;">No workstations</span></div>`;
  }
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { key: "Available", count: counts.Available || 0, color: "var(--color-available)" },
    { key: "In use", count: counts["In use"] || 0, color: "var(--color-occupied)" },
    { key: "Idle", count: counts.Idle || 0, color: "var(--color-idle)" },
    { key: "Offline", count: counts.Offline || 0, color: "var(--color-offline)" },
    { key: "Maintenance", count: counts.Maintenance || 0, color: "var(--color-maintenance)" },
    { key: "Unknown", count: counts.Unknown || 0, color: "var(--color-unknown)" }
  ];

  let cumulative = 0;
  const circles = segments.map((seg) => {
    if (!seg.count) return "";
    const pct = seg.count / total;
    const dash = pct * circumference;
    const offset = circumference - cumulative;
    cumulative += dash;
    return `<circle cx="90" cy="90" r="${radius}" fill="none" stroke="${seg.color}" stroke-width="20"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}"
      class="donut-segment" data-action="donut-status" data-status="${seg.key}" title="${seg.key}: ${seg.count}" />`;
  }).join("");

  const availPct = Math.round(((counts.Available || 0) / total) * 100);

  return `
    <div class="donut-chart-container">
      <svg viewBox="0 0 180 180" class="donut-chart-svg">
        <circle cx="90" cy="90" r="${radius}" fill="none" stroke="var(--border)" stroke-width="20" opacity="0.3" />
        ${circles}
      </svg>
      <div class="donut-center">
        <span class="donut-percentage">${availPct}%</span>
        <span class="donut-label">Ready</span>
      </div>
    </div>`;
}

const discoveryCategoriesList = [
  { name: "All Workstations", icon: "Grid" },
  { name: "Available Now", icon: "CheckCircle" },
  { name: "Programming", icon: "Code" },
  { name: "Cybersecurity", icon: "ShieldCheck" },
  { name: "Database", icon: "DatabaseIcon" },
  { name: "AI & Machine Learning", icon: "Sparkles" },
  { name: "Web Development", icon: "Cpu" },
  { name: "Design Tools", icon: "Palette" },
  { name: "Networking", icon: "NetworkIcon" }
];

/* ---------------- 1. DASHBOARD – AIRBNB EXPLORE EXPERIENCE ---------------- */
function renderStudentDashboard(workstations, labs, softwareList) {
  const total = workstations.length;
  const availableCount = workstations.filter((w) => w.status === "Available").length;
  const inUseCount = workstations.filter((w) => w.status === "In use").length;
  const idleCount = workstations.filter((w) => w.status === "Idle").length;
  const offlineCount = workstations.filter((w) => w.status === "Offline").length;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const studentName = state.user?.name ? state.user.name.split(" ")[0] : "Student";
  const todayFormatted = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  // Popular software detection count across campus
  const softwareMap = new Map();
  for (const ws of workstations) {
    const seenOnWs = new Set();
    for (const item of ws.software || []) {
      if (!item.name || seenOnWs.has(item.name)) continue;
      seenOnWs.add(item.name);
      softwareMap.set(item.name, (softwareMap.get(item.name) || 0) + 1);
    }
  }
  const topSoftware = [...softwareMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Filter workstations by active Airbnb category
  const activeCategory = state.activeCategory || "All Workstations";
  const categoryWorkstations = workstations.filter((w) => matchesCategory(w, activeCategory));

  // Autocomplete suggestions for capsule search
  const popularSuggestions = ["Python", "Java", "MongoDB", "Visual Studio Code", "Wireshark", "Docker", "Git", "Node.js", "C++", "PostgreSQL"];

  // Recently reported workstations
  const recentlyActive = [...workstations]
    .sort((a, b) => Date.parse(b.lastHeartbeat || b.lastInventoryScan || 0) - Date.parse(a.lastHeartbeat || a.lastInventoryScan || 0))
    .slice(0, 5);

  return `
    <div class="airbnb-explore-container">
      <!-- A. Welcome Header -->
      <section class="airbnb-welcome-hero">
        <div class="welcome-hero-text">
          <div class="welcome-greeting-badge">
            <span class="live-pulse-dot"></span>
            <span>${escapeHtml(greeting)}, ${escapeHtml(studentName)} · ${escapeHtml(todayFormatted)}</span>
          </div>
          <h1 class="welcome-hero-title">Discover Your Next Workstation</h1>
          <p class="welcome-hero-subtitle">Find the right computer, software, and laboratory before you visit.</p>
        </div>
        <div class="welcome-hero-badges">
          <span class="hero-chip">${icon("Profile")} USN: ${escapeHtml(state.user?.identifier || "Registered")}</span>
          <span class="hero-chip">${icon("Laboratories")} Dept: ${escapeHtml(state.user?.department || "General")}</span>
          <span class="hero-chip api-status-chip">
            <span class="status-indicator-dot"></span>
            ${state.apiLatency || 12}ms API Telemetry
          </span>
        </div>
      </section>

      <!-- B. Floating Search Capsule (Airbnb 3-Segment Style) -->
      <section class="search-capsule-wrapper">
        <form id="airbnb-search-form" class="floating-search-capsule" role="search">
          <!-- 1. Find Software -->
          <div class="capsule-segment" data-segment="software">
            <label for="capsule-software" class="capsule-label">Find Software</label>
            <input id="capsule-software" name="software" type="search" class="capsule-input" 
                   placeholder="Python, Java, MongoDB, VS Code..." 
                   value="${escapeHtml(state.search)}" list="capsule-software-datalist" autocomplete="off" />
            <datalist id="capsule-software-datalist">
              ${popularSuggestions.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("")}
            </datalist>
          </div>

          <div class="capsule-divider"></div>

          <!-- 2. Choose Laboratory -->
          <div class="capsule-segment" data-segment="lab">
            <label for="capsule-lab" class="capsule-label">Choose Laboratory</label>
            <select id="capsule-lab" name="lab" class="capsule-select">
              <option value="">All laboratories</option>
              ${labs.map((l) => `<option value="${escapeHtml(l.name)}" ${state.lab === l.name ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
            </select>
          </div>

          <div class="capsule-divider"></div>

          <!-- 3. Workstation Availability -->
          <div class="capsule-segment" data-segment="status">
            <label for="capsule-status" class="capsule-label">Availability</label>
            <select id="capsule-status" name="availability" class="capsule-select">
              <option value="">All workstations</option>
              <option value="Available" ${state.availability === "Available" ? "selected" : ""}>Available</option>
              <option value="In use" ${state.availability === "In use" ? "selected" : ""}>Occupied / In Use</option>
              <option value="Offline" ${state.availability === "Offline" ? "selected" : ""}>Offline</option>
            </select>
          </div>

          <!-- Search Action Button -->
          <button type="submit" class="capsule-search-btn" aria-label="Search workstations">
            ${icon("Search")}
            <span class="capsule-btn-text">Search</span>
          </button>
        </form>
      </section>

      <!-- C. Horizontal Discovery Categories -->
      <section class="airbnb-categories-bar">
        <div class="categories-scroll-track" id="categories-track">
          ${discoveryCategoriesList.map((cat) => `
            <button type="button" class="category-item-btn ${activeCategory === cat.name ? "active" : ""}" 
                    data-action="select-category" data-category="${escapeHtml(cat.name)}">
              <span class="category-icon-wrap">${icon(cat.icon)}</span>
              <span class="category-title">${escapeHtml(cat.name)}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <!-- D. Workstation Discovery Cards (Airbnb Listing Pattern) -->
      <section class="airbnb-listings-section">
        <div class="section-title-row">
          <div>
            <h2 class="airbnb-section-title">${escapeHtml(activeCategory)}</h2>
            <p class="airbnb-section-subtitle">Showing ${categoryWorkstations.length} workstation${categoryWorkstations.length === 1 ? "" : "s"} ready for academic coursework</p>
          </div>
          <button type="button" class="airbnb-view-all-link" data-action="quick-nav" data-target="Find a Workstation">
            View all workstations ${icon("ArrowRight")}
          </button>
        </div>

        ${categoryWorkstations.length ? `
          <div class="airbnb-listings-grid">
            ${categoryWorkstations.slice(0, 8).map((w) => {
              const isFavorited = state.favorites.has(w.id);
              const softList = w.software || [];
              const topSoft = softList.slice(0, 3);
              const remainingCount = softList.length - 3;
              return `
                <article class="airbnb-listing-card">
                  <!-- Visual Cover Area with Dynamic Workstation Illustration -->
                  <div class="listing-visual-wrap" data-action="open-workstation" data-id="${escapeHtml(w.id)}" role="button" tabindex="0" aria-label="View workstation ${escapeHtml(w.id)}">
                    ${svgWorkstationIllustration(w)}
                    <div class="listing-badge-overlay">
                      <span class="listing-status-badge ${statusClass(w.status)}">
                        <span class="status-pulse-dot"></span>
                        ${escapeHtml(w.status)}
                      </span>
                    </div>
                    <button type="button" class="listing-favorite-btn ${isFavorited ? "active" : ""}" 
                            data-action="toggle-favorite" data-id="${escapeHtml(w.id)}" 
                            aria-label="${isFavorited ? "Remove from saved" : "Save workstation"}">
                      ${icon(isFavorited ? "HeartFilled" : "Heart")}
                    </button>
                  </div>

                  <!-- Clean Card Content -->
                  <div class="listing-content">
                    <div class="listing-header-row">
                      <div class="listing-title-group" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                        <h3 class="listing-title">${escapeHtml(w.id)}</h3>
                        <span class="listing-hostname">${escapeHtml(w.hostname || "Workstation")}</span>
                      </div>
                      <span class="listing-os-pill">${escapeHtml(w.os ? w.os.split(" ")[0] : "OS")}</span>
                    </div>

                    <p class="listing-location">
                      ${icon("Laboratories")}
                      <span>${escapeHtml(w.lab)} · ${escapeHtml(w.room || "Room not reported")}</span>
                    </p>

                    <!-- Important Installed Software Chips -->
                    <div class="listing-software-chips">
                      ${topSoft.length ? topSoft.map((s) => `
                        <span class="listing-soft-chip">${escapeHtml(s.name)}</span>
                      `).join("") : '<span class="listing-soft-chip muted">Standard OS</span>'}
                      ${remainingCount > 0 ? `<span class="listing-soft-chip more">+${remainingCount} more</span>` : ""}
                    </div>

                    <!-- Card Footer: Live Telemetry & Relative Reported Time -->
                    <div class="listing-footer-row">
                      <div class="listing-telemetry">
                        <span>RAM: ${formatBytes(w.memoryTotalBytes)}</span>
                        <span>· CPU: ${w.health?.cpuPercent == null ? "N/A" : `${w.health.cpuPercent}%`}</span>
                      </div>
                      <span class="listing-time">${escapeHtml(timeAgo(w.lastHeartbeat || w.lastInventoryScan))}</span>
                    </div>

                    <button type="button" class="listing-action-btn" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                      View Details ${icon("ArrowRight")}
                    </button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        ` : emptyPanel(`No workstations found under "${escapeHtml(activeCategory)}". Try selecting another category or view all.`)}
      </section>

      <!-- E. Live Availability Overview -->
      <section class="airbnb-availability-overview">
        <div class="availability-card-interactive" data-action="quick-nav" data-target="Find a Workstation">
          <div class="avail-card-header">
            <span class="avail-label">Total Workstations</span>
            ${icon("Server")}
          </div>
          <div class="avail-number">${total}</div>
          <span class="avail-footer">Across ${labs.length} laboratories</span>
        </div>

        <div class="availability-card-interactive highlight-available" data-action="quick-nav" data-target="Find a Workstation" data-filter="Available">
          <div class="avail-card-header">
            <span class="avail-label">Available Now</span>
            ${icon("CheckCircle")}
          </div>
          <div class="avail-number text-available">${availableCount}</div>
          <span class="avail-footer">${total ? Math.round((availableCount / total) * 100) : 0}% of fleet ready</span>
        </div>

        <div class="availability-card-interactive highlight-occupied" data-action="quick-nav" data-target="Find a Workstation" data-filter="In use">
          <div class="avail-card-header">
            <span class="avail-label">Occupied / In Use</span>
            ${icon("UserCheck")}
          </div>
          <div class="avail-number text-occupied">${inUseCount}</div>
          <span class="avail-footer">Active student sessions</span>
        </div>

        <div class="availability-card-interactive highlight-offline" data-action="quick-nav" data-target="Find a Workstation" data-filter="Offline">
          <div class="avail-card-header">
            <span class="avail-label">Offline / Standby</span>
            ${icon("PowerOff")}
          </div>
          <div class="avail-number text-offline">${offlineCount + idleCount}</div>
          <span class="avail-footer">${offlineCount} offline, ${idleCount} idle</span>
        </div>
      </section>

      <!-- F. Explore Laboratories (Airbnb Destinations Layout) -->
      <section class="airbnb-destinations-section">
        <div class="section-title-row">
          <div>
            <h2 class="airbnb-section-title">Explore Laboratories</h2>
            <p class="airbnb-section-subtitle">Browse campus computing facilities, room numbers, and available hardware</p>
          </div>
          <button type="button" class="airbnb-view-all-link" data-action="quick-nav" data-target="Laboratories">
            All laboratories ${icon("ArrowRight")}
          </button>
        </div>

        ${labs.length ? `
          <div class="airbnb-destinations-grid">
            ${labs.slice(0, 4).map((lab) => {
              const labStations = workstations.filter((w) => w.lab === lab.name);
              const labAvail = labStations.filter((w) => w.status === "Available").length;
              const pct = labStations.length ? Math.round((labAvail / labStations.length) * 100) : 0;
              return `
                <article class="airbnb-destination-card" data-action="select-lab" data-lab="${escapeHtml(lab.name)}">
                  <div class="destination-visual-wrap">
                    ${svgLabIllustration(lab.name)}
                    <span class="destination-room-pill">${escapeHtml(lab.room || "Lab Facility")}</span>
                  </div>
                  <div class="destination-info">
                    <h3 class="destination-name">${escapeHtml(lab.name)}</h3>
                    <div class="destination-meta-row">
                      <span><strong>${labStations.length}</strong> computers</span>
                      <span>·</span>
                      <span class="text-available"><strong>${labAvail}</strong> ready (${pct}%)</span>
                    </div>
                    <div class="destination-capacity-bar">
                      <div class="destination-capacity-fill" style="width: ${pct}%;"></div>
                    </div>
                    <button type="button" class="destination-explore-btn" data-action="select-lab" data-lab="${escapeHtml(lab.name)}">
                      Explore Lab Inventory ${icon("ArrowRight")}
                    </button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        ` : emptyPanel("No laboratories registered in the system yet.")}
      </section>

      <!-- G. Popular Software Across Campus -->
      <section class="airbnb-software-section">
        <div class="section-title-row">
          <div>
            <h2 class="airbnb-section-title">Explore Software Across Your Campus</h2>
            <p class="airbnb-section-subtitle">Click any detected developer environment or package to find computers equipped with it</p>
          </div>
          <button type="button" class="airbnb-view-all-link" data-action="quick-nav" data-target="Find a Workstation" data-focus="software">
            Search all tools ${icon("ArrowRight")}
          </button>
        </div>

        ${topSoftware.length ? `
          <div class="airbnb-software-grid">
            ${topSoftware.map(([name, count]) => `
              <button type="button" class="airbnb-software-card" data-action="select-software" data-software="${escapeHtml(name)}">
                <div class="software-card-top">
                  <span class="software-card-name">${escapeHtml(name)}</span>
                  <span class="software-cat-chip">${categorizeSoftware(name)}</span>
                </div>
                <div class="software-card-bottom">
                  <span class="software-count-text"><strong>${count}</strong> computer${count === 1 ? "" : "s"} detected</span>
                  <span class="software-card-arrow">${icon("ArrowRight")}</span>
                </div>
              </button>
            `).join("")}
          </div>
        ` : emptyPanel("No software reported by workstation monitoring agents yet.")}
      </section>

      <!-- H. Recently Reported Workstations -->
      <section class="airbnb-recent-section">
        <div class="section-title-row">
          <div>
            <h2 class="airbnb-section-title">Recently Reporting Workstations</h2>
            <p class="airbnb-section-subtitle">Live heartbeat and telemetry signals received from authorized lab computers</p>
          </div>
          <button type="button" class="airbnb-view-all-link" data-action="quick-nav" data-target="Find a Workstation">
            View full inventory ${icon("ArrowRight")}
          </button>
        </div>

        ${recentlyActive.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Laboratory</th>
                  <th>Status</th>
                  <th>Last Reported</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${recentlyActive.map((w) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(w.id)}</strong>
                      <span class="table-room">${escapeHtml(w.hostname || "Workstation")}</span>
                    </td>
                    <td>
                      ${escapeHtml(w.lab)}
                      <span class="table-room">${escapeHtml(w.room || "Room")}</span>
                    </td>
                    <td>${badge(w.status)}</td>
                    <td>${escapeHtml(timeAgo(w.lastHeartbeat || w.lastInventoryScan))}</td>
                    <td>
                      <button type="button" class="secondary-button compact-button" data-action="open-workstation" data-id="${escapeHtml(w.id)}">Details</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : emptyPanel("No active workstation telemetry reported yet.")}
      </section>
    </div>
  `;
}

/* ---------------- 2. FIND A WORKSTATION PAGE ---------------- */
function renderFindWorkstationPage(workstations, labs, softwareList) {
  const osList = [...new Set(workstations.map((w) => w.os).filter(Boolean))];
  const query = state.search.trim().toLowerCase();

  // Filter workstations
  let filtered = workstations.filter((w) => {
    const matchesLab = !state.lab || w.lab === state.lab;
    const matchesOs = !state.os || w.os === state.os;
    const matchesAvail = !state.availability || w.status === state.availability;
    let matchesQuery = true;
    if (query) {
      const idMatch = w.id.toLowerCase().includes(query);
      const hostMatch = (w.hostname || "").toLowerCase().includes(query);
      const roomMatch = (w.room || "").toLowerCase().includes(query);
      const softMatch = (w.software || []).some((s) => `${s.name} ${s.version} ${s.publisher}`.toLowerCase().includes(query));
      matchesQuery = idMatch || hostMatch || roomMatch || softMatch;
    }
    return matchesLab && matchesOs && matchesAvail && matchesQuery;
  });

  // Sort workstations
  const sortBy = state.sortBy || "id-asc";
  filtered.sort((a, b) => {
    if (sortBy === "id-desc") return b.id.localeCompare(a.id);
    if (sortBy === "status") {
      const order = { Available: 1, "In use": 2, Idle: 3, Maintenance: 4, Offline: 5, Unknown: 6 };
      return (order[a.status] || 99) - (order[b.status] || 99);
    }
    if (sortBy === "recent") {
      return Date.parse(b.lastHeartbeat || b.lastInventoryScan || 0) - Date.parse(a.lastHeartbeat || a.lastInventoryScan || 0);
    }
    if (sortBy === "cpu") {
      return (a.health?.cpuPercent ?? 100) - (b.health?.cpuPercent ?? 100);
    }
    return a.id.localeCompare(b.id);
  });

  const page = pageItems(filtered, "workstations", 12);
  const availableCount = filtered.filter((w) => w.status === "Available").length;
  const inUseCount = filtered.filter((w) => w.status === "In use").length;
  const offlineCount = filtered.filter((w) => w.status === "Offline").length;

  return `
    <div class="find-workstation-view">
      <!-- Search & Filters Panel (Airbnb Search Page Pattern) -->
      <section class="find-filter-panel">
        <form id="student-search-form">
          <div class="filter-controls-row">
            <label class="field" style="margin:0;">
              <span>Search Computer or Software</span>
              <div class="input-shell">
                ${icon("Search")}
                <input name="software" type="search" value="${escapeHtml(state.search)}" placeholder="Search ID, hostname, Python, MongoDB, VS Code..." aria-label="Search computer or software" />
              </div>
            </label>

            <label class="field" style="margin:0;">
              <span>Laboratory</span>
              <select name="lab">
                <option value="">All Laboratories</option>
                ${labs.map((l) => `<option value="${escapeHtml(l.name)}" ${l.name === state.lab ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
              </select>
            </label>

            <label class="field" style="margin:0;">
              <span>Operating System</span>
              <select name="os">
                <option value="">All Operating Systems</option>
                ${osList.map((os) => `<option value="${escapeHtml(os)}" ${os === state.os ? "selected" : ""}>${escapeHtml(os)}</option>`).join("")}
              </select>
            </label>

            <label class="field" style="margin:0;">
              <span>Status</span>
              <select name="availability">
                <option value="">All Statuses</option>
                ${["Available", "In use", "Idle", "Offline", "Maintenance", "Unknown"].map((s) => `<option value="${s}" ${state.availability === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </label>

            <label class="field" style="margin:0;">
              <span>Sort By</span>
              <select name="sortBy">
                <option value="id-asc" ${sortBy === "id-asc" ? "selected" : ""}>ID (A to Z)</option>
                <option value="id-desc" ${sortBy === "id-desc" ? "selected" : ""}>ID (Z to A)</option>
                <option value="status" ${sortBy === "status" ? "selected" : ""}>Available First</option>
                <option value="recent" ${sortBy === "recent" ? "selected" : ""}>Most Recently Active</option>
                <option value="cpu" ${sortBy === "cpu" ? "selected" : ""}>Lowest CPU Usage</option>
              </select>
            </label>

            <div style="display:flex; gap:8px;">
              <button type="submit" class="primary-button" style="white-space:nowrap;">Search</button>
              <button type="button" class="secondary-button" data-action="clear-student-filters">Reset</button>
            </div>
          </div>
        </form>

        <!-- Active Filter Pills & View Toggles -->
        <div class="filter-pills-bar">
          <span style="font-size:0.75rem; color:var(--muted); font-weight:600;">Active Filters:</span>
          ${!state.search && !state.lab && !state.os && !state.availability ? '<span style="font-size:0.75rem; color:var(--muted);">None (Showing all workstations)</span>' : ""}
          ${state.search ? `
            <span class="filter-chip-removable">
              Search: "<strong>${escapeHtml(state.search)}</strong>"
              <button type="button" class="filter-chip-remove-btn" data-action="clear-filter-chip" data-filter-type="search" aria-label="Remove search filter">✕</button>
            </span>
          ` : ""}
          ${state.lab ? `
            <span class="filter-chip-removable">
              Lab: <strong>${escapeHtml(state.lab)}</strong>
              <button type="button" class="filter-chip-remove-btn" data-action="clear-filter-chip" data-filter-type="lab" aria-label="Remove lab filter">✕</button>
            </span>
          ` : ""}
          ${state.os ? `
            <span class="filter-chip-removable">
              OS: <strong>${escapeHtml(state.os)}</strong>
              <button type="button" class="filter-chip-remove-btn" data-action="clear-filter-chip" data-filter-type="os" aria-label="Remove OS filter">✕</button>
            </span>
          ` : ""}
          ${state.availability ? `
            <span class="filter-chip-removable">
              Status: <strong>${escapeHtml(state.availability)}</strong>
              <button type="button" class="filter-chip-remove-btn" data-action="clear-filter-chip" data-filter-type="availability" aria-label="Remove status filter">✕</button>
            </span>
          ` : ""}

          <div style="margin-left:auto; display:flex; align-items:center; gap:10px;">
            <span style="font-size:0.78rem; color:var(--muted);">Showing ${filtered.length} computer${filtered.length === 1 ? "" : "s"}</span>
            <div class="view-toggle-wrap">
              <button type="button" class="view-toggle-btn ${state.viewMode === "grid" ? "active" : ""}" data-action="set-view-mode" data-mode="grid" aria-label="Grid view">${icon("Grid")}<span>Cards</span></button>
              <button type="button" class="view-toggle-btn ${state.viewMode === "table" ? "active" : ""}" data-action="set-view-mode" data-mode="table" aria-label="Table view">${icon("List")}<span>Table</span></button>
            </div>
          </div>
        </div>
      </section>

      <!-- Workstations Presentation -->
      ${filtered.length ? `
        ${page.controls}
        ${state.viewMode === "grid" ? `
          <div class="airbnb-listings-grid">
            ${page.items.map((w) => {
              const isFavorited = state.favorites.has(w.id);
              const softList = w.software || [];
              const topSoft = softList.slice(0, 3);
              const remainingCount = softList.length - 3;
              return `
                <article class="airbnb-listing-card">
                  <!-- Visual Cover Area -->
                  <div class="listing-visual-wrap" data-action="open-workstation" data-id="${escapeHtml(w.id)}" role="button" tabindex="0">
                    ${svgWorkstationIllustration(w)}
                    <div class="listing-badge-overlay">
                      <span class="listing-status-badge ${statusClass(w.status)}">
                        <span class="status-pulse-dot"></span>
                        ${escapeHtml(w.status)}
                      </span>
                    </div>
                    <button type="button" class="listing-favorite-btn ${isFavorited ? "active" : ""}" 
                            data-action="toggle-favorite" data-id="${escapeHtml(w.id)}" 
                            aria-label="${isFavorited ? "Remove from saved" : "Save workstation"}">
                      ${icon(isFavorited ? "HeartFilled" : "Heart")}
                    </button>
                  </div>

                  <!-- Content -->
                  <div class="listing-content">
                    <div class="listing-header-row">
                      <div class="listing-title-group" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                        <h3 class="listing-title">${escapeHtml(w.id)}</h3>
                        <span class="listing-hostname">${escapeHtml(w.hostname || "Workstation")}</span>
                      </div>
                      <span class="listing-os-pill">${escapeHtml(w.os ? w.os.split(" ")[0] : "OS")}</span>
                    </div>

                    <p class="listing-location">
                      ${icon("Laboratories")}
                      <span>${escapeHtml(w.lab)} · ${escapeHtml(w.room || "Room not reported")}</span>
                    </p>

                    <!-- Important Installed Software Chips -->
                    <div class="listing-software-chips">
                      ${topSoft.length ? topSoft.map((s) => `
                        <span class="listing-soft-chip">${escapeHtml(s.name)}</span>
                      `).join("") : '<span class="listing-soft-chip muted">Standard OS</span>'}
                      ${remainingCount > 0 ? `<span class="listing-soft-chip more">+${remainingCount} more</span>` : ""}
                    </div>

                    <!-- Live Telemetry & Relative Time -->
                    <div class="listing-footer-row">
                      <div class="listing-telemetry">
                        <span>RAM: ${formatBytes(w.memoryTotalBytes)}</span>
                        <span>· CPU: ${w.health?.cpuPercent == null ? "N/A" : `${w.health.cpuPercent}%`}</span>
                      </div>
                      <span class="listing-time">${escapeHtml(timeAgo(w.lastHeartbeat || w.lastInventoryScan))}</span>
                    </div>

                    <button type="button" class="listing-action-btn" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                      View System Details ${icon("ArrowRight")}
                    </button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        ` : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Laboratory</th>
                  <th>Status</th>
                  <th>OS & CPU</th>
                  <th>RAM / Disk</th>
                  <th>Health</th>
                  <th>Software</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${page.items.map((w) => `
                  <tr>
                    <td>
                      <button type="button" class="table-link" data-action="open-workstation" data-id="${escapeHtml(w.id)}">${escapeHtml(w.id)}</button>
                      <span class="table-room">${escapeHtml(w.hostname || "Workstation")}</span>
                    </td>
                    <td>
                      ${escapeHtml(w.lab)}
                      <span class="table-room">${escapeHtml(w.room || "Room not reported")}</span>
                    </td>
                    <td>${badge(w.status)}</td>
                    <td>
                      <div>${escapeHtml(w.os || "Not reported")}</div>
                      <span class="table-room" style="max-width:180px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(w.cpu || "Not reported")}</span>
                    </td>
                    <td>
                      <div>${formatBytes(w.memoryTotalBytes)}</div>
                      <span class="table-room">${formatBytes(w.diskTotalBytes)}</span>
                    </td>
                    <td>
                      <span style="font-size:0.75rem;">CPU: ${w.health?.cpuPercent == null ? "N/A" : `${w.health.cpuPercent}%`}</span>
                    </td>
                    <td>
                      <span class="chip soft">${w.software?.length || 0} packages</span>
                    </td>
                    <td>
                      <button type="button" class="secondary-button compact-button" data-action="open-workstation" data-id="${escapeHtml(w.id)}">Details</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
      ` : emptyPanel("No workstations match your search or filter criteria. Try clearing filters.")}
    </div>
  `;
}

/* ---------------- 3. LABORATORIES EXPLORATION PAGE ---------------- */
function renderLaboratoriesPage(workstations, labs, softwareList) {
  // If user selected a specific lab to inspect:
  if (state.selectedLabName) {
    const labName = state.selectedLabName;
    const lab = labs.find((l) => l.name === labName) || { name: labName, room: "Assigned Lab" };
    const labStations = workstations.filter((w) => w.lab === labName);
    const availableCount = labStations.filter((w) => w.status === "Available").length;
    const inUseCount = labStations.filter((w) => w.status === "In use").length;
    const offlineCount = labStations.filter((w) => w.status === "Offline").length;
    const pct = labStations.length ? Math.round((availableCount / labStations.length) * 100) : 0;
    const osList = [...new Set(labStations.map((w) => w.os).filter(Boolean))];

    // Collect software detected across this lab
    const labSoftware = new Map();
    for (const ws of labStations) {
      for (const item of ws.software || []) {
        if (!item.name) continue;
        labSoftware.set(item.name, (labSoftware.get(item.name) || 0) + 1);
      }
    }
    const topLabSoftware = [...labSoftware.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

    return `
      <div class="lab-detail-view">
        <button type="button" class="lab-breadcrumb-btn" data-action="back-to-labs">
          ${icon("ArrowRight")} Back to All Laboratories
        </button>

        <section class="lab-detail-hero">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <p class="eyebrow">Laboratory Facility Details</p>
              <h2 style="font-size:1.8rem; margin:4px 0 6px 0;">${escapeHtml(lab.name)}</h2>
              <p style="color:var(--muted); font-size:0.9rem;">Room: <strong>${escapeHtml(lab.room || "Room not reported")}</strong> · Registered Campus Computer Laboratory</p>
            </div>
            ${badge(availableCount > 0 ? "Available" : labStations.length === 0 ? "Unknown" : "In use")}
          </div>

          <div class="lab-detail-stats-grid">
            <div class="metric-box light"><span>Total Workstations</span><strong>${labStations.length}</strong></div>
            <div class="metric-box light"><span>Available Now</span><strong style="color:var(--color-available);">${availableCount}</strong></div>
            <div class="metric-box light"><span>In Use</span><strong style="color:var(--color-occupied);">${inUseCount}</strong></div>
            <div class="metric-box light"><span>Offline</span><strong style="color:var(--color-offline);">${offlineCount}</strong></div>
          </div>

          <!-- Capacity Track -->
          <div class="lab-capacity-bar-wrap" style="margin-top:16px;">
            <div class="lab-capacity-label">
              <span>Facility Capacity Readiness</span>
              <strong>${availableCount} of ${labStations.length} Ready (${pct}%)</strong>
            </div>
            <div class="lab-capacity-track">
              <div class="lab-capacity-fill" style="width: ${pct}%;"></div>
            </div>
          </div>

          ${osList.length ? `
            <div style="margin-top:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:0.75rem; color:var(--muted); font-weight:600;">Operating Systems:</span>
              ${osList.map((os) => `<span class="chip soft">${escapeHtml(os)}</span>`).join("")}
            </div>
          ` : ""}
        </section>

        <!-- Top Software in this Lab -->
        <section class="panel" style="margin-bottom:20px;">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Laboratory Inventory</p>
              <h3>Top Detected Software in ${escapeHtml(lab.name)}</h3>
            </div>
            <span class="demo-tag">${labSoftware.size} Packages</span>
          </div>
          ${topLabSoftware.length ? `
            <div class="software-catalog-grid">
              ${topLabSoftware.map(([name, count]) => `
                <div class="software-catalog-tag">
                  <span class="software-tag-name">${escapeHtml(name)}</span>
                  <span class="software-count-chip">${count} ${count === 1 ? "PC" : "PCs"}</span>
                  <span class="software-cat-badge">${categorizeSoftware(name)}</span>
                </div>
              `).join("")}
            </div>
          ` : emptyPanel("No software scans reported for this laboratory yet.")}
        </section>

        <!-- Workstations Assigned to this Lab -->
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Hardware Allocation</p>
              <h3>Workstations Assigned to this Facility (${labStations.length})</h3>
            </div>
          </div>
          ${labStations.length ? `
            <div class="airbnb-listings-grid" style="margin-top:16px;">
              ${labStations.map((w) => {
                const isFavorited = state.favorites.has(w.id);
                const softList = w.software || [];
                const topSoft = softList.slice(0, 3);
                return `
                  <article class="airbnb-listing-card">
                    <div class="listing-visual-wrap" data-action="open-workstation" data-id="${escapeHtml(w.id)}" role="button" tabindex="0">
                      ${svgWorkstationIllustration(w)}
                      <div class="listing-badge-overlay">
                        <span class="listing-status-badge ${statusClass(w.status)}">${escapeHtml(w.status)}</span>
                      </div>
                      <button type="button" class="listing-favorite-btn ${isFavorited ? "active" : ""}" 
                              data-action="toggle-favorite" data-id="${escapeHtml(w.id)}">
                        ${icon(isFavorited ? "HeartFilled" : "Heart")}
                      </button>
                    </div>
                    <div class="listing-content">
                      <div class="listing-header-row">
                        <div class="listing-title-group" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                          <h3 class="listing-title">${escapeHtml(w.id)}</h3>
                          <span class="listing-hostname">${escapeHtml(w.hostname || "Workstation")}</span>
                        </div>
                        <span class="listing-os-pill">${escapeHtml(w.os ? w.os.split(" ")[0] : "OS")}</span>
                      </div>
                      <div class="listing-software-chips">
                        ${topSoft.map((s) => `<span class="listing-soft-chip">${escapeHtml(s.name)}</span>`).join("")}
                      </div>
                      <button type="button" class="listing-action-btn" data-action="open-workstation" data-id="${escapeHtml(w.id)}">
                        View Details ${icon("ArrowRight")}
                      </button>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          ` : emptyPanel("No workstations currently assigned to this laboratory.")}
        </section>
      </div>
    `;
  }

  // All Labs Directory Grid (Airbnb Destinations Style)
  const query = state.labSearch.trim().toLowerCase();
  const filteredLabs = labs.filter((l) => {
    if (!query) return true;
    return l.name.toLowerCase().includes(query) || (l.room || "").toLowerCase().includes(query);
  });

  return `
    <div class="laboratories-view">
      <!-- Search Lab Bar -->
      <section class="find-filter-panel" style="margin-bottom:24px;">
        <form id="lab-search-form" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <label class="field search-field" style="flex:1; min-width:240px; margin:0;">
            <span>Search Laboratory or Room</span>
            <div class="input-shell">
              ${icon("Search")}
              <input name="labSearch" type="search" value="${escapeHtml(state.labSearch)}" placeholder="Search by lab name, department, or room number..." aria-label="Search laboratories" />
            </div>
          </label>
          <button type="submit" class="primary-button">Search Labs</button>
          ${state.labSearch ? '<button type="button" class="secondary-button" data-action="clear-lab-search">Clear</button>' : ""}
        </form>
      </section>

      <!-- Laboratories Destinations Grid -->
      ${filteredLabs.length ? `
        <div class="airbnb-destinations-grid">
          ${filteredLabs.map((lab) => {
            const labStations = workstations.filter((w) => w.lab === lab.name);
            const labAvail = labStations.filter((w) => w.status === "Available").length;
            const pct = labStations.length ? Math.round((labAvail / labStations.length) * 100) : 0;
            return `
              <article class="airbnb-destination-card" data-action="select-lab" data-lab="${escapeHtml(lab.name)}">
                <div class="destination-visual-wrap">
                  ${svgLabIllustration(lab.name)}
                  <span class="destination-room-pill">${escapeHtml(lab.room || "Room not reported")}</span>
                </div>
                <div class="destination-info">
                  <h3 class="destination-name">${escapeHtml(lab.name)}</h3>
                  <div class="destination-meta-row">
                    <span><strong>${labStations.length}</strong> total PCs</span>
                    <span>·</span>
                    <span class="text-available"><strong>${labAvail}</strong> ready (${pct}%)</span>
                  </div>
                  <div class="destination-capacity-bar">
                    <div class="destination-capacity-fill" style="width: ${pct}%;"></div>
                  </div>
                  <button type="button" class="destination-explore-btn" data-action="select-lab" data-lab="${escapeHtml(lab.name)}">
                    Explore Lab Inventory ${icon("ArrowRight")}
                  </button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : emptyPanel("No laboratories match your search query. Try another keyword.")}
    </div>
  `;
}

/* ---------------- Main Student Page Dispatcher ---------------- */
async function renderStudentPage() {
  if (state.page === "Profile") return renderProfilePage();
  if (state.page === "Settings") return renderSettingsPage();
  if (state.page === "System details") {
    const response = await api("/api/student/workstations");
    const selected = response.workstations.find((item) => item.id === state.selectedWorkstationId);
    if (!selected) return emptyPanel("This workstation is no longer available to your account. Return to the workstation list and choose another.");
    return renderWorkstationPage({ ...selected, allWorkstations: response.workstations });
  }

  const t0 = performance.now();
  const [labResponse, workstationResponse, softwareResponse] = await Promise.all([
    api("/api/student/labs"),
    api("/api/student/workstations"),
    api("/api/student/software")
  ]);
  state.apiLatency = Math.round(performance.now() - t0);

  const allWorkstations = workstationResponse.workstations || [];
  const allLabs = labResponse.labs || [];
  const allSoftware = softwareResponse.software || [];

  if (state.page === "Dashboard") {
    return renderStudentDashboard(allWorkstations, allLabs, allSoftware);
  }
  if (state.page === "Laboratories") {
    return renderLaboratoriesPage(allWorkstations, allLabs, allSoftware);
  }
  return renderFindWorkstationPage(allWorkstations, allLabs, allSoftware);
}

function metricBox(label, value, className = "") {
  return `<div class="metric-box ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function adminWorkstationTable(rows) {
  if (!rows.length) return emptyPanel("Register a workstation and install its authorized monitoring agent to begin receiving data.");
  const page = pageItems(rows, "workstations");
  return `${page.controls}<div class="table-wrap"><table><thead><tr>
    <th>Workstation</th>
    <th>Laboratory</th>
    <th>Status</th>
    <th>IP Address</th>
    <th>OS</th>
    <th>Heartbeat</th>
    <th>Inventory Scan</th>
    <th>Health</th>
    <th>Actions</th>
  </tr></thead><tbody>${page.items.map((item) => {
    const isRevoked = item.revoked || item.status === "Revoked";
    return `<tr>
    <td><button type="button" class="table-link" data-action="open-workstation" data-id="${escapeHtml(item.id)}">${escapeHtml(item.id)}</button><span class="table-room">${escapeHtml(item.hostname || "Hostname not reported")}</span>${structuredWorkstationDetails(item)}</td>
    <td>${escapeHtml(item.lab)}<span class="table-room">${escapeHtml(item.room || "Room not reported")}</span></td>
    <td>${isRevoked ? `<span class="badge danger">Revoked</span>` : badge(item.status)}</td>
    <td><strong>${escapeHtml(item.ipAddress || "Not reported")}</strong><span class="table-room">v${escapeHtml(item.agentVersion || "1.0.0")}</span></td>
    <td>${escapeHtml(item.os || "Not available")}</td>
    <td>${escapeHtml(formatDate(item.lastHeartbeat))}</td>
    <td>${escapeHtml(formatDate(item.lastInventoryScan))}<span class="table-room">${escapeHtml(item.inventoryFreshness)}</span></td>
    <td>${escapeHtml(item.health?.cpuPercent == null ? "Not available" : `${item.health.cpuPercent}% CPU`)}<span class="table-room">${escapeHtml(item.health?.network || "Not available")} network</span></td>
    <td class="table-actions">
      ${isRevoked ? `
        <button type="button" class="primary-button compact-button" data-action="reconnect-workstation" data-id="${escapeHtml(item.id)}" title="Generate a one-command PowerShell installer to re-enroll this PC">Re-enroll</button>
        <button type="button" class="secondary-button compact-button delete-pc-btn" data-action="delete-workstation" data-id="${escapeHtml(item.id)}" title="Permanently delete this registered workstation">Delete</button>
      ` : `
        <button type="button" class="secondary-button compact-button" data-action="reconnect-workstation" data-id="${escapeHtml(item.id)}" title="Generate a one-command PowerShell installer to reconnect this PC">Reconnect</button>
        <button type="button" class="secondary-button compact-button" data-action="toggle-maintenance" data-id="${escapeHtml(item.id)}" data-maintenance="${item.status === "Maintenance"}">${item.status === "Maintenance" ? "Restore" : "Maintenance"}</button>
        <button type="button" class="secondary-button compact-button danger-button-text" data-action="revoke-workstation" data-id="${escapeHtml(item.id)}" title="Revoke agent token immediately">Revoke</button>
        <button type="button" class="secondary-button compact-button delete-pc-btn" data-action="delete-workstation" data-id="${escapeHtml(item.id)}" title="Permanently delete this registered workstation">Delete</button>
      `}
    </td>
  </tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderActiveEnrollmentCard(enrollment) {
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

  return `<div class="enrollment-active-card ${isCompleted ? "enrollment-completed-card" : ""}" id="active-enrollment-panel">
    <div class="enrollment-card-header">
      <div class="enrollment-card-title">
        <span class="pulse-indicator ${isCompleted ? "pulse-success" : isFailed ? "pulse-failed" : "pulse-active"}"></span>
        <div>
          <h4>${isCompleted ? "Workstation Connected Successfully!" : `Waiting for Connection: ${escapeHtml(enrollment.workstationId)}`}</h4>
          <p class="muted-copy">Laboratory: <strong>${escapeHtml(enrollment.lab || "Main Laboratory")}</strong> ${enrollment.room ? `· ${escapeHtml(enrollment.room)}` : ""} · Token valid for 15 minutes</p>
        </div>
      </div>
      <div class="enrollment-card-actions">
        <button type="button" class="secondary-button compact-button" data-action="dismiss-enrollment">
          ${isCompleted ? "Close Banner" : "Dismiss"}
        </button>
      </div>
    </div>

    ${!isCompleted ? `
      <div class="enrollment-body">
        <div class="enrollment-instructions">
          <strong>Step 1:</strong> On the computer you want to add (<strong>${escapeHtml(enrollment.workstationId)}</strong>), open <strong>PowerShell as Administrator</strong>.<br>
          <strong>Step 2:</strong> Paste and run this one-line setup command:
        </div>

        <div class="enrollment-command-container">
          <div class="command-box-shell">
            <pre><code>${escapeHtml(enrollment.command)}</code></pre>
          </div>
          <button type="button" class="primary-button copy-cmd-btn" data-action="copy-enroll-command">
            ${state.enrollmentCopied ? "✓ Copied to Clipboard!" : "📋 Copy PowerShell Command"}
          </button>
        </div>

        <!-- 4-step live visual progress tracker -->
        <div class="enrollment-progress-tracker">
          <div class="progress-step step-${getStepState(1)}">
            <div class="step-circle">${getStepState(1) === "completed" ? "✓" : "1"}</div>
            <div class="step-info">
              <span class="step-title">Command Ready</span>
              <span class="step-sub">Awaiting execution</span>
            </div>
          </div>
          <div class="progress-divider"></div>
          <div class="progress-step step-${getStepState(2)}">
            <div class="step-circle">${getStepState(2) === "completed" ? "✓" : "2"}</div>
            <div class="step-info">
              <span class="step-title">Connecting</span>
              <span class="step-sub">Installer running</span>
            </div>
          </div>
          <div class="progress-divider"></div>
          <div class="progress-step step-${getStepState(3)}">
            <div class="step-circle">${getStepState(3) === "completed" ? "✓" : "3"}</div>
            <div class="step-info">
              <span class="step-title">Self-Registering</span>
              <span class="step-sub">Keys exchange</span>
            </div>
          </div>
          <div class="progress-divider"></div>
          <div class="progress-step step-${getStepState(4)}">
            <div class="step-circle">${getStepState(4) === "completed" ? "✓" : "4"}</div>
            <div class="step-info">
              <span class="step-title">Online & Active</span>
              <span class="step-sub">Live telemetry</span>
            </div>
          </div>
        </div>

        <div class="enrollment-status-bar">
          <span class="status-pill status-${enrollment.status}">
            ${escapeHtml(enrollment.status.toUpperCase().replace("_", " "))}
          </span>
          <span class="status-message">${escapeHtml(enrollment.progressMessage || "Waiting for target computer to execute the command...")}</span>
          ${enrollment.targetIp ? `<span class="target-ip-badge">IP: ${escapeHtml(enrollment.targetIp)}</span>` : ""}
        </div>
      </div>
    ` : `
      <div class="enrollment-success-content">
        <div class="success-icon-banner">🎉</div>
        <div class="success-details">
          <h3>${escapeHtml(enrollment.workstationId)} is Live and Connected!</h3>
          <p>The monitoring agent has successfully registered, verified telemetry, and is transmitting real-time hardware metrics and software inventory.</p>
          ${enrollment.targetHostname ? `<p class="device-meta">Hostname: <strong>${escapeHtml(enrollment.targetHostname)}</strong> · IP: <strong>${escapeHtml(enrollment.targetIp || "LAN")}</strong></p>` : ""}
        </div>
        <div class="success-actions">
          <button type="button" class="primary-button" data-action="open-workstation" data-id="${escapeHtml(enrollment.workstationId)}">
            View Workstation Dashboard
          </button>
          <button type="button" class="secondary-button" data-action="dismiss-enrollment">
            Add Another Workstation
          </button>
        </div>
      </div>
    `}
  </div>`;
}

function renderLegacyCredentialPanel(credential) {
  return `<div class="credential-panel" role="status">
    <div class="credential-panel-header" style="display:flex; justify-content:space-between; align-items:center;">
      <strong>⚠️ Manual Agent Credential Generated</strong>
      <button type="button" class="compact-button secondary-button" data-action="dismiss-legacy-credential">Dismiss</button>
    </div>
    <p>Workstation ID: <strong>${escapeHtml(credential.workstationId)}</strong></p>
    <code>${escapeHtml(credential.agentToken)}</code>
    <div class="credential-actions" style="margin: 8px 0;">
      <button type="button" class="secondary-button" data-action="copy-token">Copy token</button>
    </div>
    <p class="credential-note">Configure the authorized computer by pasting this token into <code>agent/.env</code> (<code>AGENT_TOKEN=${escapeHtml(credential.agentToken)}</code>). Do not share it.</p>
  </div>`;
}

function renderWorkstationsAdminView(overview, filteredStations, stations) {
  const workstationDraft = state.workstationDraft || {};
  const activeEnrollment = state.activeEnrollment;
  const legacyCredential = state.agentCredential;
  const showManual = state.showManualSetup;

  const nextId = workstationDraft.id || `WS-${String(stations.length + 1).padStart(3, "0")}`;

  return `<div class="admin-view">
    ${overview}
    <section class="panel admin-table-panel">
      <div class="panel-header section-header">
        <div>
          <p class="eyebrow">Zero-Friction Device Setup</p>
          <h3>Connect New Workstation</h3>
          <p class="section-subtitle">Add a computer to the laboratory tracker. One PowerShell command on the target computer handles downloading, agent setup, self-registration, and background auto-start.</p>
        </div>
        <div class="header-action-group">
          <button type="button" class="secondary-button compact-button" data-action="toggle-manual-mode">
            ${showManual ? "Switch to 1-Command Auto Setup" : "Manual Token Setup"}
          </button>
        </div>
      </div>

      <!-- Active 1-Command Enrollment Banner (if active) -->
      ${activeEnrollment ? renderActiveEnrollmentCard(activeEnrollment) : ""}

      <!-- Legacy Token Banner (if manual token was generated) -->
      ${legacyCredential ? renderLegacyCredentialPanel(legacyCredential) : ""}

      <!-- Workstation Registration Form -->
      <form id="register-workstation-form" class="register-device-form modern-enroll-form">
        <input type="hidden" name="setupMode" value="${showManual ? "manual" : "automated"}" />
        <div class="form-grid-3">
          ${field("Workstation ID", "id", "text", true, "e.g. WS-001, LAB-PC-12", workstationDraft.id || nextId)}
          ${field("Laboratory", "lab", "text", true, "e.g. Software Engineering Lab", workstationDraft.lab || "")}
          ${field("Room / Location", "room", "text", false, "e.g. Room 302, Floor 3", workstationDraft.room || "")}
        </div>
        
        <div class="enroll-form-footer">
          <div class="enroll-hint">
            ${showManual ? `
              <span class="hint-icon">⚙️</span>
              <span><strong>Manual Mode:</strong> Registers database entry and provides raw agent token for custom <code>.env</code> configurations.</span>
            ` : `
              <span class="hint-icon">🚀</span>
              <span><strong>Auto-Setup (Recommended):</strong> Generates an instant, pre-configured PowerShell command. No python or manual file editing needed on the target PC.</span>
            `}
          </div>
          <button class="primary-button enroll-submit-btn" type="submit">
            ${showManual ? "Register & Generate Token" : "⚡ Generate 1-Command Installer"}
          </button>
        </div>
      </form>

      <!-- Table Section -->
      <div class="table-section-divider"></div>
      <div class="panel-header">
        <div>
          <p class="eyebrow">Authorized Devices Directory</p>
          <h3>Workstation Management</h3>
        </div>
      </div>
      ${adminSearchForm({ statuses: true })}
      ${recordTools()}
      ${adminWorkstationTable(filteredStations)}
    </section>
  </div>`;
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
    return renderWorkstationsAdminView(overview, filteredStations, stations);
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
  if (action === "toggle-user-dropdown") {
    state.userMenuOpen = !state.userMenuOpen;
    renderShell(document.getElementById("page-content")?.innerHTML || "");
    return;
  } else if (action === "toggle-theme") {
    const current = themePreference();
    const next = current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark";
    setThemePreference(next);
    state.error = "";
    state.message = `Theme switched to ${next} mode.`;
    await refresh();
    return;
  } else if (action === "toggle-favorite") {
    const wsId = target.dataset.id;
    if (wsId) {
      if (state.favorites.has(wsId)) {
        state.favorites.delete(wsId);
      } else {
        state.favorites.add(wsId);
      }
      try {
        localStorage.setItem("lab-favorites", JSON.stringify([...state.favorites]));
      } catch {}
      await refresh();
    }
    return;
  } else if (action === "select-category") {
    state.activeCategory = target.dataset.category || "All Workstations";
    await refresh();
    return;
  } else if (action === "open-workstation") {
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
  } else if (action === "quick-nav") {
    state.page = target.dataset.target || "Dashboard";
    if (target.dataset.filter) state.availability = target.dataset.filter;
    if (target.dataset.focus === "software") {
      state.search = "";
    }
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "nav-filter") {
    state.page = target.dataset.nav || "Find a Workstation";
    if (target.dataset.filter) state.availability = target.dataset.filter;
    if (target.dataset.lab) state.lab = target.dataset.lab;
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "donut-status") {
    state.page = "Find a Workstation";
    state.availability = target.dataset.status || "";
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "select-lab") {
    state.page = "Laboratories";
    state.selectedLabName = target.dataset.lab || "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "back-to-labs") {
    state.page = "Laboratories";
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "select-software") {
    state.page = "Find a Workstation";
    state.search = target.dataset.software || "";
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
  } else if (action === "set-view-mode") {
    state.viewMode = target.dataset.mode || "grid";
    await refresh();
  } else if (action === "clear-filter-chip") {
    const fType = target.dataset.filterType;
    if (fType === "search") state.search = "";
    if (fType === "lab") state.lab = "";
    if (fType === "os") state.os = "";
    if (fType === "availability") state.availability = "";
    state.listPages = {};
    await refresh();
  } else if (action === "clear-lab-search") {
    state.labSearch = "";
    await refresh();
  } else if (action === "clear-student-filters") {
    state.search = "";
    state.lab = "";
    state.os = "";
    state.availability = "";
    state.sortBy = "id-asc";
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
    stopEnrollmentPolling();
    state.activeEnrollment = null;
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
  } else if (action === "copy-enroll-command") {
    if (state.activeEnrollment?.command) {
      try {
        await navigator.clipboard.writeText(state.activeEnrollment.command);
        state.enrollmentCopied = true;
        await refresh({ preserveFocus: true });
        setTimeout(() => {
          state.enrollmentCopied = false;
          refresh({ preserveFocus: true });
        }, 3000);
      } catch {
        state.error = "Clipboard access is unavailable. Select and copy the command text manually.";
        await refresh();
      }
    }
  } else if (action === "dismiss-enrollment") {
    stopEnrollmentPolling();
    state.activeEnrollment = null;
    state.enrollmentCopied = false;
    await refresh();
  } else if (action === "dismiss-legacy-credential") {
    state.agentCredential = null;
    await refresh();
  } else if (action === "toggle-manual-mode") {
    state.showManualSetup = !state.showManualSetup;
    await refresh();
  } else if (action === "reconnect-workstation") {
    const workstationId = target.dataset.id;
    try {
      const reconnectData = await api(`/api/admin/workstations/${encodeURIComponent(workstationId)}/reconnect`, {
        method: "POST",
        body: "{}"
      });
      state.activeEnrollment = reconnectData;
      state.enrollmentCopied = false;
      state.page = "Workstations";
      state.message = `Generated 1-command installer for ${workstationId}! Run it on the lab computer.`;
      startEnrollmentPolling(reconnectData.enrollmentId);
      await refresh();
      document.getElementById("active-enrollment-panel")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      state.error = err.message;
      await refresh();
    }
  } else if (action === "revoke-workstation") {
    const workstationId = target.dataset.id;
    if (!window.confirm(`Revoke access for workstation ${workstationId}?\n\nThe agent on this computer will be immediately disconnected and cannot submit metrics or software inventory until re-enrolled.`)) {
      return;
    }
    try {
      await api(`/api/admin/workstations/${encodeURIComponent(workstationId)}/revoke`, {
        method: "POST",
        body: "{}"
      });
      state.message = `Workstation ${workstationId} access has been revoked.`;
      state.error = "";
      await refresh();
    } catch (err) {
      state.error = err.message;
      await refresh();
    }
  } else if (action === "delete-workstation") {
    const workstationId = target.dataset.id;
    if (!window.confirm(`Permanently delete workstation ${workstationId}?\n\nThis will remove the workstation from the system, including its software inventory, metrics history, alerts, and enrollment records.\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      await api(`/api/admin/workstations/${encodeURIComponent(workstationId)}`, {
        method: "DELETE"
      });
      state.message = `Workstation ${workstationId} has been permanently deleted.`;
      state.error = "";
      if (state.selectedWorkstationId === workstationId) {
        state.selectedWorkstationId = null;
        state.page = "Workstations";
      }
      await refresh();
    } catch (err) {
      state.error = err.message;
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

  if (formId === "airbnb-search-form") {
    state.search = String(values.software || "").trim();
    state.lab = values.lab || "";
    state.availability = values.availability || "";
    state.page = "Find a Workstation";
    state.selectedLabName = "";
    state.selectedWorkstationId = "";
    state.listPages = {};
    state.error = "";
    state.message = "";
    await refresh();
    return;
  }

  if (formId === "student-search-form") {
    state.search = String(values.software || "").trim();
    state.lab = values.lab || "";
    state.os = values.os || "";
    state.availability = values.availability || "";
    state.sortBy = values.sortBy || "id-asc";
    state.listPages = {};
    await refresh({ preserveFocus: true });
    return;
  }

  if (formId === "lab-search-form") {
    state.labSearch = String(values.labSearch || "").trim();
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
    const isManual = form.querySelector('input[name="setupMode"]')?.value === "manual";
    const draft = {
      workstationId: String(values.id || "").trim().toUpperCase(),
      lab: String(values.lab || "").trim(),
      room: String(values.room || "").trim()
    };
    state.workstationDraft = { id: draft.workstationId, lab: draft.lab, room: draft.room };
    let invalid = null;
    if (draft.workstationId && !/^[A-Z0-9-]{2,32}$/.test(draft.workstationId)) {
      invalid = ["id", "Use 2 to 32 letters, numbers, or hyphens for the workstation ID."];
    } else if (!draft.lab) {
      invalid = ["lab", "Enter the laboratory name."];
    }
    if (invalid) {
      injectFieldError(form, invalid[0], invalid[1]);
      return;
    }

    try {
      if (isManual) {
        state.agentCredential = await api("/api/admin/workstations", {
          method: "POST",
          body: JSON.stringify({ id: draft.workstationId, lab: draft.lab, room: draft.room })
        });
        state.activeEnrollment = null;
        state.workstationDraft = null;
        state.message = "Workstation registered. Copy the manual credential below and configure its agent.";
      } else {
        const enrollData = await api("/api/admin/enrollment/generate", {
          method: "POST",
          body: JSON.stringify(draft)
        });
        state.activeEnrollment = enrollData;
        state.enrollmentCopied = false;
        state.agentCredential = null;
        state.workstationDraft = null;
        state.message = `Generated 1-command installer for ${enrollData.workstationId}! Paste it into PowerShell on the lab computer.`;
        startEnrollmentPolling(enrollData.enrollmentId);
      }
      await refresh();
    } catch (error) {
      state.error = error.message;
      await refresh();
    }
    return;
  }
}

app.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "search") return;
  const form = input.form;
  if (!form || !["student-search-form", "admin-search-form", "workstation-software-search", "lab-search-form"].includes(form.id)) return;
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

document.addEventListener("click", (event) => {
  if (state.userMenuOpen && !event.target.closest(".airbnb-user-menu-wrapper")) {
    state.userMenuOpen = false;
    const menu = document.getElementById("user-dropdown-menu");
    if (menu) menu.remove();
  }
});

window.addEventListener("hashchange", async () => {
  if (renderRoutedPage()) return;
  if (state.user) await refresh();
  else await loadSession();
});

loadSession();
