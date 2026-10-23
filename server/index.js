import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import bcrypt from "bcryptjs";

const port = Number(process.env.API_PORT || 3001);
const host = process.env.API_HOST || "127.0.0.1";
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const heartbeatTimeout = Number(process.env.HEARTBEAT_TIMEOUT_SECONDS || 90);
const sessionTtlSeconds = 12 * 60 * 60;
const databasePath = resolve(process.env.DATABASE_PATH || "./data/lab-tracker.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    identifier TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    semester TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS labs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    room TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workstations (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL DEFAULT '',
    lab_id TEXT NOT NULL REFERENCES labs(id),
    os TEXT NOT NULL DEFAULT '',
    cpu TEXT NOT NULL DEFAULT '',
    memory_total_bytes INTEGER,
    disk_total_bytes INTEGER,
    last_heartbeat TEXT,
    last_inventory_scan TEXT,
    last_sync TEXT,
    activity_status TEXT NOT NULL DEFAULT 'unknown',
    maintenance INTEGER NOT NULL DEFAULT 0,
    maintenance_note TEXT NOT NULL DEFAULT '',
    agent_token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS software (
    workstation_id TEXT NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    publisher TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    detected_at TEXT NOT NULL,
    PRIMARY KEY(workstation_id, name, version)
  );
  CREATE TABLE IF NOT EXISTS metrics (
    workstation_id TEXT PRIMARY KEY REFERENCES workstations(id) ON DELETE CASCADE,
    cpu_percent REAL,
    memory_percent REAL,
    disk_percent REAL,
    network_status TEXT NOT NULL DEFAULT 'unknown',
    reported_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    workstation_id TEXT NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_workstations_lab ON workstations(lab_id);
  CREATE INDEX IF NOT EXISTS idx_software_name ON software(name);
  CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved_at);
`);

const now = () => new Date().toISOString();
const newId = () => randomBytes(16).toString("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const passwordHash = (password) => bcrypt.hashSync(password, 12);
const legacyPasswordHash = (password, salt) => scryptSync(password, salt, 64).toString("hex");
const dummyPasswordHash = passwordHash(randomBytes(32).toString("hex"));
const safeEqual = (left, right) => {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
function verifyPassword(password, account) {
  if (account.password_hash.startsWith("$2")) return bcrypt.compareSync(password, account.password_hash);
  return safeEqual(legacyPasswordHash(password, account.password_salt), account.password_hash);
}
const send = (res, status, value, headers = {}) => {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
};
const cookieOptions = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionTtlSeconds}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
const clearCookie = `lab_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
const sessionCookie = (token) => `lab_session=${encodeURIComponent(token)}; ${cookieOptions}`;
const RESET_CODE_TTL_MS = 30 * 60 * 1000;

function getCookie(req, name) {
  const entry = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

function syncSystemAlerts(rows = workstationRows()) {
  const activeKinds = new Set();
  for (const row of rows) {
    const status = statusFor(row);
    const staleInventory = !row.last_inventory_scan || Date.now() - Date.parse(row.last_inventory_scan) > 15 * 60 * 1000;
    const conditions = [];
    if (status === "Offline") conditions.push(["offline", "Workstation has missed its heartbeat threshold."]);
    if (staleInventory) conditions.push(["stale_inventory", "Software inventory is stale or has never been reported."]);
    for (const [kind, message] of conditions) {
      const key = `${row.id}:${kind}`;
      activeKinds.add(key);
      const existing = db.prepare("SELECT id FROM alerts WHERE workstation_id=? AND kind=? AND resolved_at IS NULL").get(row.id, kind);
      if (!existing) db.prepare("INSERT INTO alerts(id,workstation_id,kind,message,created_at) VALUES(?,?,?,?,?)")
        .run(newId(), row.id, kind, message, now());
    }
  }
  const active = db.prepare("SELECT id,workstation_id,kind FROM alerts WHERE resolved_at IS NULL").all();
  for (const alert of active) {
    if ((alert.kind === "offline" || alert.kind === "stale_inventory") && !activeKinds.has(`${alert.workstation_id}:${alert.kind}`)) {
      db.prepare("UPDATE alerts SET resolved_at=? WHERE id=?").run(now(), alert.id);
    }
  }
}

function audit(userId, action, detail) {
  db.prepare("INSERT INTO audit_logs(id,user_id,action,detail,created_at) VALUES(?,?,?,?,?)")
    .run(newId(), userId || null, action, detail, now());
}

function currentUser(req) {
  const token = getCookie(req, "lab_session");
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id,u.name,u.email,u.identifier,u.role,u.department,u.phone,u.semester,u.section
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?
  `).get(sha256(token), Math.floor(Date.now() / 1000));
  return row || null;
}

function statusFor(row) {
  if (row.maintenance) return "Maintenance";
  if (!row.last_heartbeat || Date.now() - Date.parse(row.last_heartbeat) > heartbeatTimeout * 1000) return "Offline";
  if (!row.metrics_reported_at || Date.now() - Date.parse(row.metrics_reported_at) > 180_000) return "Unknown";
  if (row.activity_status === "in_use") return "In use";
  if (row.activity_status === "idle") return "Idle";
  if (row.activity_status === "available") return "Available";
  return "Unknown";
}

function workstationRows() {
  return db.prepare(`
    SELECT w.*,l.name AS lab_name,l.room AS lab_room,m.cpu_percent,m.memory_percent,m.disk_percent,
      m.network_status,m.reported_at AS metrics_reported_at
    FROM workstations w JOIN labs l ON l.id=w.lab_id
    LEFT JOIN metrics m ON m.workstation_id=w.id ORDER BY w.id
  `).all();
}

function publicWorkstation(row) {
  const stationStatus = statusFor(row);
  const staleInventory = !row.last_inventory_scan || Date.now() - Date.parse(row.last_inventory_scan) > 15 * 60 * 1000;
  const installed = db.prepare("SELECT name,version,publisher,source,detected_at FROM software WHERE workstation_id=? ORDER BY name").all(row.id);
  return {
    id: row.id, hostname: row.hostname, lab: row.lab_name, room: row.lab_room,
    status: stationStatus, os: row.os, cpu: row.cpu,
    memoryTotalBytes: row.memory_total_bytes, diskTotalBytes: row.disk_total_bytes,
    maintenanceNote: row.maintenance_note,
    lastHeartbeat: row.last_heartbeat, lastInventoryScan: row.last_inventory_scan,
    inventoryFreshness: staleInventory ? "Stale" : "Fresh",
    health: {
      cpuPercent: row.cpu_percent, memoryPercent: row.memory_percent,
      diskPercent: row.disk_percent, network: row.network_status || "Not available",
      reportedAt: row.metrics_reported_at || null
    },
    software: installed
  };
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function requireRole(user, role) {
  if (!user) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  if (user.role !== role) throw Object.assign(new Error("You do not have permission to perform this action."), { status: 403 });
}

function agentStation(req, body) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const row = db.prepare("SELECT * FROM workstations WHERE id=? AND agent_token_hash=?").get(body.workstationId, sha256(token));
  return row || null;
}

function assertBrowserOrigin(req) {
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) throw Object.assign(new Error("Request origin is not allowed."), { status: 403 });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  if (req.headers.origin && req.headers.origin !== allowedOrigin) return send(res, 403, { error: "Request origin is not allowed." });
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  const mutating = ["POST", "PATCH", "DELETE"].includes(method);
  if (mutating && path.startsWith("/api/auth/")) assertBrowserOrigin(req);

  const user = currentUser(req);

  if (method === "GET" && path === "/api/health") return send(res, 200, { status: "ok", serverTime: now() });
  if (method === "GET" && path === "/api/auth/me") return send(res, 200, { user });

  if (method === "POST" && path === "/api/auth/register") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const identifier = String(body.usn || "").trim();
    const password = body.password;
    const phone = String(body.phone || "").trim();
    const department = String(body.department || "").trim();
    const semester = String(body.semester || "").trim();
    const section = String(body.section || "").trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !identifier || !phone || phone.replace(/\D/g, "").length < 7 || !department || !semester || !section) {
      return send(res, 400, { error: "Enter your name, valid college email, student USN, valid phone number, department, semester, and section." });
    }
    if (password !== body.confirmPassword) return send(res, 400, { error: "The passwords do not match." });
    if (!validPassword(password)) return send(res, 400, { error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    const salt = "";
    try {
      db.prepare(`INSERT INTO users(id,name,email,identifier,role,password_salt,password_hash,department,phone,semester,section,created_at)
        VALUES(?,?,?,?, 'student',?,?,?,?,?,?,?)`).run(
        newId(), name, email, identifier, salt, passwordHash(password),
        department, phone, semester, section, now()
      );
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return send(res, 409, { error: "That email or student USN is already registered." });
      throw error;
    }
    const created = db.prepare("SELECT id,name,email,identifier,role,department,phone,semester,section FROM users WHERE email=?").get(email);
    audit(created.id, "student.register", "Student account created");
    const sessionToken = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
      .run(sha256(sessionToken), created.id, Math.floor(Date.now() / 1000) + sessionTtlSeconds);
    return send(res, 201, { user: created }, { "Set-Cookie": `lab_session=${encodeURIComponent(sessionToken)}; ${cookieOptions}` });
  }

  if (method === "POST" && path === "/api/auth/login") {
    const body = await readBody(req);
    const identifier = String(body.identifier || "").trim();
    const account = db.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE OR identifier=? COLLATE NOCASE").get(identifier, identifier);
    const password = String(body.password || "");
    const validCredentials = account ? verifyPassword(password, account) : bcrypt.compareSync(password, dummyPasswordHash);
    if (!validCredentials) return send(res, 401, { error: "The email/identifier or password is incorrect." });
    const sessionToken = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
      .run(sha256(sessionToken), account.id, Math.floor(Date.now() / 1000) + sessionTtlSeconds);
    audit(account.id, "auth.login", "Successful login");
    const safeUser = {
      id: account.id, name: account.name, email: account.email,
      identifier: account.identifier, role: account.role,
      department: account.department, phone: account.phone,
      semester: account.semester, section: account.section
    };
    return send(res, 200, { user: safeUser }, { "Set-Cookie": `lab_session=${encodeURIComponent(sessionToken)}; ${cookieOptions}` });
  }

  if (method === "POST" && path === "/api/auth/setup-admin") {
    assertBrowserOrigin(req);
    const body = await readBody(req);
    const expected = process.env.ADMIN_SETUP_TOKEN;
    if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) return send(res, 409, { error: "An administrator has already been created." });
    if (!expected) return send(res, 503, { error: "Administrator setup is disabled. Configure ADMIN_SETUP_TOKEN on the server." });
    if (!body.setupToken || !safeEqual(sha256(String(body.setupToken)), sha256(expected))) return send(res, 403, { error: "The administrator setup token is not valid." });
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const identifier = String(body.employeeId || "").trim();
    const department = String(body.department || "").trim();
    if (!name || !identifier || !department || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: "Enter administrator name, institutional email, employee ID, and department or assigned lab." });
    if (body.password !== body.confirmPassword) return send(res, 400, { error: "The passwords do not match." });
    if (!validPassword(body.password)) return send(res, 400, { error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    const salt = "";
    const adminId = newId();
    try {
      db.prepare(`INSERT INTO users(id,name,email,identifier,role,password_salt,password_hash,department,created_at)
        VALUES(?,?,?,?, 'admin',?,?,?,?)`).run(adminId, name, email, identifier, salt, passwordHash(body.password), department, now());
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return send(res, 409, { error: "That email or employee ID is already registered. Use an unused administrator email and ID." });
      }
      throw error;
    }
    process.env.ADMIN_SETUP_TOKEN = "";
    audit(adminId, "admin.setup", "Initial administrator provisioned");
    const sessionToken = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
      .run(sha256(sessionToken), adminId, Math.floor(Date.now() / 1000) + sessionTtlSeconds);
    const created = db.prepare("SELECT id,name,email,identifier,role,department FROM users WHERE id=?").get(adminId);
    return send(res, 201, { user: created }, { "Set-Cookie": `lab_session=${encodeURIComponent(sessionToken)}; ${cookieOptions}` });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    assertBrowserOrigin(req);
    const token = getCookie(req, "lab_session");
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha256(token));
    return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie });
  }

  if (method === "PATCH" && path === "/api/auth/profile") {
    if (!user) return send(res, 401, { error: "Sign in to continue." });
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const department = String(body.department || "").trim();
    const semester = String(body.semester || "").trim();
    const section = String(body.section || "").trim();
    if (!name) return send(res, 400, { error: "Enter your full name." });
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 7 || phoneDigits.length > 15) return send(res, 400, { error: "Enter a valid phone number (7 to 15 digits)." });
    if (user.role === "student" && (!department || !semester || !section)) return send(res, 400, { error: "Enter your department, semester, and section." });
    db.prepare("UPDATE users SET name=?,phone=?,department=?,semester=?,section=? WHERE id=?")
      .run(name, phone, department, semester, section, user.id);
    audit(user.id, "profile.update", "Profile details updated");
    const updated = db.prepare("SELECT id,name,email,identifier,role,department,phone,semester,section FROM users WHERE id=?").get(user.id);
    return send(res, 200, { user: updated });
  }

  if (method === "POST" && path === "/api/auth/change-password") {
    if (!user) return send(res, 401, { error: "Sign in to continue." });
    const body = await readBody(req);
    const account = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    const current = String(body.currentPassword || "");
    const next = body.newPassword;
    if (!verifyPassword(current, account)) return send(res, 403, { error: "The current password is incorrect." });
    if (next !== body.confirmPassword) return send(res, 400, { error: "The new passwords do not match." });
    if (!validPassword(next)) return send(res, 400, { error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    if (next === current) return send(res, 400, { error: "Choose a password different from your current one." });
    db.prepare("UPDATE users SET password_hash=?,password_salt='' WHERE id=?").run(passwordHash(next), account.id);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(account.id);
    audit(account.id, "auth.password_change", "Password changed; all sessions revoked");
    const sessionToken = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
      .run(sha256(sessionToken), account.id, Math.floor(Date.now() / 1000) + sessionTtlSeconds);
    return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(sessionToken) });
  }

  if (method === "POST" && path === "/api/auth/logout-all") {
    assertBrowserOrigin(req);
    if (user) {
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      audit(user.id, "auth.logout_all", "Signed out of all devices");
    }
    return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie });
  }

  if (method === "POST" && path === "/api/auth/reset-password") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (body.password !== body.confirmPassword) return send(res, 400, { error: "The passwords do not match." });
    if (!validPassword(body.password)) return send(res, 400, { error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    const account = db.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").get(email);
    let reset = null;
    if (account) {
      const record = db.prepare("SELECT value FROM settings WHERE key=?").get(`password_reset:${account.id}`);
      try { reset = record ? JSON.parse(record.value) : null; } catch { reset = null; }
    }
    const codeOk = Boolean(reset && reset.expiresAt > Date.now() && safeEqual(sha256(code), reset.codeHash));
    if (!account || !codeOk) {
      bcrypt.compareSync(code || "invalid", dummyPasswordHash);
      return send(res, 400, { error: "The email, reset code, or code expiry is invalid. Ask your administrator for a new code." });
    }
    db.prepare("UPDATE users SET password_hash=?,password_salt='' WHERE id=?").run(passwordHash(body.password), account.id);
    db.prepare("DELETE FROM settings WHERE key=?").run(`password_reset:${account.id}`);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(account.id);
    audit(account.id, "auth.password_reset", "Password reset with administrator-issued code");
    return send(res, 200, { ok: true });
  }

  if (method === "DELETE" && path === "/api/auth/account") {
    if (!user) return send(res, 401, { error: "Sign in to continue." });
    const body = await readBody(req);
    const account = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    if (!verifyPassword(String(body.password || ""), account)) return send(res, 403, { error: "The password is incorrect. Enter your password to confirm deletion." });
    if (String(body.confirmation || "").trim().toUpperCase() !== "DELETE") return send(res, 400, { error: "Type DELETE to confirm account deletion." });
    if (account.role === "admin" && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count <= 1) {
      return send(res, 409, { error: "This is the only administrator account. Provision another administrator before deleting it." });
    }
    db.prepare("DELETE FROM settings WHERE key=?").run(`password_reset:${account.id}`);
    db.prepare("UPDATE audit_logs SET user_id=NULL WHERE user_id=?").run(account.id);
    db.prepare("DELETE FROM users WHERE id=?").run(account.id);
    audit(null, "account.delete", "Account removed by its owner");
    return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie });
  }

  if (method === "GET" && path === "/api/student/labs") {
    requireRole(user, "student");
    return send(res, 200, { labs: db.prepare("SELECT name,room FROM labs ORDER BY name").all() });
  }

  if (method === "GET" && path === "/api/student/workstations") {
    requireRole(user, "student");
    const q = (url.searchParams.get("software") || "").trim().toLowerCase();
    const lab = url.searchParams.get("lab") || "";
    const os = url.searchParams.get("os") || "";
    const rows = workstationRows()
      .filter((row) => (!lab || row.lab_name === lab) && (!os || row.os === os))
      .map(publicWorkstation)
      .filter((row) => !q || (row.inventoryFreshness === "Fresh" && row.software.some((item) => `${item.name} ${item.version}`.toLowerCase().includes(q))));
    return send(res, 200, { workstations: rows, serverTime: now() });
  }

  if (method === "GET" && path === "/api/student/software") {
    requireRole(user, "student");
    const terms = db.prepare("SELECT DISTINCT name FROM software ORDER BY name").all().map((row) => row.name);
    return send(res, 200, { software: terms });
  }

  if (method === "GET" && path === "/api/admin/dashboard") {
    requireRole(user, "admin");
    const rows = workstationRows();
    syncSystemAlerts(rows);
    const statuses = rows.map(statusFor);
    const counts = Object.fromEntries(["Available", "In use", "Idle", "Offline", "Maintenance", "Unknown"].map((status) => [status, statuses.filter((value) => value === status).length]));
    return send(res, 200, {
      total: rows.length, counts,
      staleInventory: rows.filter((row) => !row.last_inventory_scan || Date.now() - Date.parse(row.last_inventory_scan) > 15 * 60 * 1000).length,
      openAlerts: db.prepare("SELECT COUNT(*) AS count FROM alerts WHERE resolved_at IS NULL").get().count
    });
  }

  if (method === "GET" && path === "/api/admin/workstations") {
    requireRole(user, "admin");
    syncSystemAlerts();
    return send(res, 200, { workstations: workstationRows().map(publicWorkstation) });
  }

  if (method === "POST" && path === "/api/admin/workstations") {
    requireRole(user, "admin");
    const body = await readBody(req);
    const id = String(body.id || "").trim().toUpperCase();
    const labName = String(body.lab || "").trim();
    if (!/^[A-Z0-9-]{2,32}$/.test(id) || !labName) return send(res, 400, { error: "Provide a workstation ID (letters, numbers, hyphens) and lab name." });
    if (db.prepare("SELECT id FROM workstations WHERE id=?").get(id)) return send(res, 409, { error: "That workstation ID is already registered." });
    const lab = db.prepare("SELECT id FROM labs WHERE name=? COLLATE NOCASE").get(labName) || { id: newId() };
    if (!db.prepare("SELECT id FROM labs WHERE name=? COLLATE NOCASE").get(labName)) {
      db.prepare("INSERT INTO labs(id,name,room,created_at) VALUES(?,?,?,?)").run(lab.id, labName, String(body.room || "").trim(), now());
    }
    const agentToken = randomBytes(32).toString("base64url");
    try {
      db.prepare(`INSERT INTO workstations(id,hostname,lab_id,os,agent_token_hash,created_at)
        VALUES(?,?,?,?,?,?)`).run(id, "", lab.id, "", sha256(agentToken), now());
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return send(res, 409, { error: "That workstation ID is already registered." });
      throw error;
    }
    audit(user.id, "workstation.create", id);
    return send(res, 201, { workstationId: id, agentToken, warning: "Copy the agent token now. It cannot be retrieved later." });
  }

  const rotateAgentToken = path.match(/^\/api\/admin\/workstations\/([^/]+)\/rotate-token$/);
  if (method === "POST" && rotateAgentToken) {
    requireRole(user, "admin");
    const workstationId = decodeURIComponent(rotateAgentToken[1]);
    const station = db.prepare("SELECT id FROM workstations WHERE id=?").get(workstationId);
    if (!station) return send(res, 404, { error: "Workstation not found." });
    const agentToken = randomBytes(32).toString("base64url");
    db.prepare("UPDATE workstations SET agent_token_hash=? WHERE id=?").run(sha256(agentToken), station.id);
    audit(user.id, "workstation.agent_token.rotate", station.id);
    return send(res, 200, { workstationId: station.id, agentToken, warning: "The previous token is revoked. Copy the new token now; it cannot be retrieved later." });
  }

  if (method === "GET" && path === "/api/admin/users") {
    requireRole(user, "admin");
    return send(res, 200, { users: db.prepare("SELECT id,name,email,identifier,role,department,created_at FROM users ORDER BY role,name").all() });
  }

  const userResetCode = path.match(/^\/api\/admin\/users\/([^/]+)\/reset-code$/);
  if (method === "POST" && userResetCode) {
    requireRole(user, "admin");
    const account = db.prepare("SELECT id,name,email FROM users WHERE id=?").get(decodeURIComponent(userResetCode[1]));
    if (!account) return send(res, 404, { error: "Account not found." });
    const code = randomBytes(6).toString("hex");
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(`password_reset:${account.id}`, JSON.stringify({ codeHash: sha256(code), expiresAt: Date.now() + RESET_CODE_TTL_MS }));
    audit(user.id, "admin.password_reset_code", `Reset code issued for ${account.email}`);
    return send(res, 200, {
      userId: account.id, name: account.name, email: account.email, code,
      expiresInMinutes: RESET_CODE_TTL_MS / 60000,
      warning: "Share this code with the account owner through an approved channel. It expires and can be shown only once."
    });
  }

  const workstationPatch = path.match(/^\/api\/admin\/workstations\/([^/]+)$/);
  if (method === "PATCH" && workstationPatch) {
    requireRole(user, "admin");
    const body = await readBody(req);
    const station = db.prepare("SELECT id FROM workstations WHERE id=?").get(decodeURIComponent(workstationPatch[1]));
    if (!station) return send(res, 404, { error: "Workstation not found." });
    if (typeof body.maintenance !== "boolean") return send(res, 400, { error: "Specify maintenance as true or false." });
    db.prepare("UPDATE workstations SET maintenance=?,maintenance_note=? WHERE id=?")
      .run(body.maintenance ? 1 : 0, body.maintenance ? String(body.note || "").trim() : "", station.id);
    audit(user.id, body.maintenance ? "workstation.maintenance" : "workstation.restored", `${station.id}: ${String(body.note || "")}`);
    return send(res, 200, { workstation: publicWorkstation(workstationRows().find((row) => row.id === station.id)) });
  }

  if (method === "GET" && path === "/api/admin/alerts") {
    requireRole(user, "admin");
    syncSystemAlerts();
    return send(res, 200, { alerts: db.prepare(`
      SELECT a.id,a.workstation_id AS workstationId,a.kind,a.message,a.created_at AS createdAt,a.resolved_at AS resolvedAt
      FROM alerts a ORDER BY a.created_at DESC LIMIT 200
    `).all() });
  }

  if (method === "GET" && path === "/api/admin/reports") {
    requireRole(user, "admin");
    const rows = workstationRows();
    const labs = db.prepare("SELECT id,name,room FROM labs ORDER BY name").all().map((lab) => {
      const labRows = rows.filter((row) => row.lab_id === lab.id);
      return { name: lab.name, total: labRows.length, available: labRows.filter((row) => statusFor(row) === "Available").length };
    });
    return send(res, 200, { generatedAt: now(), historicalUsage: null, laboratories: labs });
  }

  if (method === "POST" && path.startsWith("/api/agent/")) {
    const body = await readBody(req);
    const station = agentStation(req, body);
    if (!station) return send(res, 401, { error: "Agent credential or workstation identity is invalid." });
    const timestamp = now();
    if (path === "/api/agent/heartbeat") {
      const os = String(body.os || "").slice(0, 160);
      const cpu = String(body.cpu || "").slice(0, 160);
      const activity = ["available", "in_use", "idle", "unknown"].includes(body.activityStatus) ? body.activityStatus : "unknown";
      db.prepare(`UPDATE workstations SET hostname=?,os=?,cpu=?,memory_total_bytes=?,disk_total_bytes=?,
        last_heartbeat=?,last_sync=?,activity_status=? WHERE id=?`).run(
        String(body.hostname || "").slice(0, 255), os, cpu,
        Number.isSafeInteger(body.memoryTotalBytes) ? body.memoryTotalBytes : null,
        Number.isSafeInteger(body.diskTotalBytes) ? body.diskTotalBytes : null,
        timestamp, timestamp, activity, station.id
      );
      return send(res, 200, { ok: true, serverTime: timestamp });
    }
    if (path === "/api/agent/inventory") {
      if (!Array.isArray(body.software) || body.software.length > 5000) return send(res, 400, { error: "Software inventory must be an array of at most 5000 applications." });
      const tx = db.prepare("INSERT OR REPLACE INTO software(workstation_id,name,version,publisher,source,detected_at) VALUES(?,?,?,?,?,?)");
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM software WHERE workstation_id=?").run(station.id);
        for (const item of body.software) {
          if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
          tx.run(station.id, item.name.trim().slice(0, 200), String(item.version || "").slice(0, 100), String(item.publisher || "").slice(0, 200), String(item.source || "unknown").slice(0, 100), timestamp);
        }
        db.prepare("UPDATE workstations SET last_inventory_scan=?,last_sync=? WHERE id=?").run(timestamp, timestamp, station.id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return send(res, 200, { ok: true, detected: body.software.length, scannedAt: timestamp });
    }
    if (path === "/api/agent/metrics") {
      const metric = (value) => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      db.prepare(`INSERT INTO metrics(workstation_id,cpu_percent,memory_percent,disk_percent,network_status,reported_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(workstation_id) DO UPDATE SET cpu_percent=excluded.cpu_percent,
        memory_percent=excluded.memory_percent,disk_percent=excluded.disk_percent,network_status=excluded.network_status,reported_at=excluded.reported_at`)
        .run(station.id, metric(body.cpuPercent), metric(body.memoryPercent), metric(body.diskPercent), String(body.networkStatus || "unknown").slice(0, 32), timestamp);
      return send(res, 200, { ok: true, reportedAt: timestamp });
    }
  }

  return send(res, 404, { error: "API route not found." });
}

const authAttempts = new Map();
const server = createServer(async (req, res) => {
  const key = req.socket.remoteAddress || "unknown";
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const authLimits = {
    "/api/auth/login": 10,
    "/api/auth/register": 5,
    "/api/auth/setup-admin": 5,
    "/api/auth/change-password": 5,
    "/api/auth/reset-password": 5
  };
  const authLimit = req.method === "POST" ? authLimits[requestPath] : 0;
  if (authLimit) {
    const bucket = `${key}:${requestPath}`;
    const entry = authAttempts.get(bucket) || { count: 0, resetAt: Date.now() + 60_000 };
    if (entry.resetAt < Date.now()) {
      entry.count = 0;
      entry.resetAt = Date.now() + 60_000;
    }
    if (entry.count >= authLimit) return send(res, 429, { error: "Too many requests. Wait a minute and try again." });
    entry.count++;
    authAttempts.set(bucket, entry);
  }
  try {
    await handle(req, res);
  } catch (error) {
    if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : "An unexpected server error occurred." });
    if (!error.status) console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`Lab Tracker API listening on http://${host}:${port}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`SQLite database: ${databasePath}`);
  console.log(`Heartbeat timeout: ${heartbeatTimeout}s`);
  console.log(`Initial administrator setup: ${process.env.ADMIN_SETUP_TOKEN ? "configured" : "disabled"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    db.close();
    server.close(() => process.exit(0));
  });
}
