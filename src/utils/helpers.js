import { THEME_KEY } from "./constants.js";

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

export function statusClass(status) {
  return ({
    Available: "available", "In use": "occupied", Idle: "warning",
    Offline: "offline", Maintenance: "maintenance", Unknown: "warning"
  })[status] || "neutral";
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "Not reported";
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(0)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

export function formatDate(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function timeAgo(value) {
  if (!value) return "No telemetry";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return "Active recently";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function categorizeSoftware(name = "") {
  const n = name.toLowerCase();
  if (/python|java|c\+\+|gcc|rust|golang|node|sdk|ruby|php|clang/i.test(n)) return "Development";
  if (/wireshark|nmap|burp|metasploit|snort|kali|security/i.test(n)) return "Cybersecurity";
  if (/mongo|sql|postgres|redis|db|mariadb|sqlite|oracle|cassandra/i.test(n)) return "Database";
  if (/pytorch|tensorflow|cuda|anaconda|jupyter|scikit|pandas|numpy/i.test(n)) return "AI & ML";
  if (/react|vue|angular|postman|nginx|apache|html|css|javascript/i.test(n)) return "Web Dev";
  if (/figma|blender|photoshop|gimp|illustrator|inkscape|cad|autocad|maya/i.test(n)) return "Design";
  if (/packet tracer|putty|ssh|telnet|cisco|gns3|ns3|tcpdump/i.test(n)) return "Networking";
  return "System Tool";
}

export function matchesCategory(ws, category) {
  if (!category || category === "All Workstations") return true;
  if (category === "Available Now") return ws.status === "Available";
  const soft = (ws.software || []).map((s) => s.name.toLowerCase()).join(" ");
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

export function passwordPolicyError(password) {
  if (typeof password !== "string" || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use at least 12 characters with uppercase, lowercase, and a number.";
  }
  return "";
}

export function themePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return ["light", "dark", "system"].includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme() {
  const pref = themePreference();
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0E141B" : "#23415C";
}

export function setThemePreference(value) {
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {}
  applyTheme();
}
