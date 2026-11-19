export const studentPages = ["Dashboard", "Find a Workstation", "Laboratories", "Profile", "Settings"];

export const adminPages = [
  "Overview",
  "Workstations",
  "Laboratories",
  "Software Inventory",
  "System Health",
  "Alerts",
  "Maintenance",
  "Reports",
  "Accounts",
  "Profile",
  "Settings"
];

export const pageSubtitles = {
  Dashboard: "Real-time laboratory ecosystem overview, capacity intelligence, and quick discovery actions.",
  "Find a Workstation": "Search computer specifications, installed software, and real-time availability before visiting a lab.",
  Laboratories: "Explore laboratory facilities, room configurations, and hardware allocations.",
  Profile: "View and update your account details and password.",
  Settings: "Manage appearance and account security preferences.",
  Accounts: "Review campus accounts and issue one-time password reset codes."
};

export const THEME_KEY = "lab-tracker-theme";
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const discoveryCategoriesList = [
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

export const staticPages = {
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
