const BASE = process.env.API_BASE || "http://127.0.0.1:3001";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";
let pass = 0, fail = 0;

function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail}`); }
}

async function call(method, path, { body, cookie, auth, origin = ORIGIN } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (auth) headers.Authorization = auth;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  const setCookie = res.headers.get("set-cookie") || "";
  const jar = setCookie ? setCookie.split(";")[0] : "";
  return { status: res.status, data, cookie: jar };
}

console.log("=== Testing Full Workstation & Agent End-to-End Flow ===");

// 1. Health check
const health = await call("GET", "/api/health");
check("Health endpoint ok", health.status === 200 && health.data.status === "ok");

// 2. Student Registration
const studentId = Date.now().toString().slice(-6);
const studentReg = await call("POST", "/api/auth/register", {
  body: {
    name: "Alex Hunter",
    email: `alex_${studentId}@college.edu`,
    usn: `USN${studentId}`,
    phone: "9876501234",
    department: "Computer Science",
    semester: "4",
    section: "C",
    password: "StudentSecure123!",
    confirmPassword: "StudentSecure123!"
  }
});
check("Student registered successfully (201)", [200, 201].includes(studentReg.status) && studentReg.data.user?.role === "student", JSON.stringify(studentReg.data));
const studentCookie = studentReg.cookie;

// 3. Student Labs list (should be empty array or current labs)
const labsBefore = await call("GET", "/api/student/labs", { cookie: studentCookie });
check("Student get labs", labsBefore.status === 200 && Array.isArray(labsBefore.data.labs));

// 4. Admin login
const adminLogin = await call("POST", "/api/auth/login", {
  body: { identifier: "admin@test.edu", password: "AdminPassw0rd123" }
});
const adminCookie = adminLogin.cookie;
check("Admin session active", Boolean(adminCookie) && adminLogin.data.user?.role === "admin");

const wsId = `WS-${studentId}`;
// 5. Admin creates workstation
const createWs = await call("POST", "/api/admin/workstations", {
  cookie: adminCookie,
  body: { id: wsId, lab: "Cybersecurity Lab", room: "Room 302" }
});
check("Admin registers workstation", [200, 201].includes(createWs.status) && Boolean(createWs.data.agentToken), JSON.stringify(createWs.data));
let agentToken = createWs.data.agentToken;

// 6. Admin rotates agent token
const rotate = await call("POST", `/api/admin/workstations/${wsId}/rotate-token`, {
  cookie: adminCookie,
  body: {}
});
check("Admin rotates agent token", rotate.status === 200 && Boolean(rotate.data.agentToken));
agentToken = rotate.data.agentToken;

// 7. Agent sends heartbeat
const heartbeat = await call("POST", "/api/agent/heartbeat", {
  auth: `Bearer ${agentToken}`,
  origin: "",
  body: {
    workstationId: wsId,
    hostname: "DESKTOP-CYBER01",
    os: "Windows 11 Pro 64-bit",
    cpu: "Intel Core i7-13700",
    memoryTotalBytes: 34359738368,
    diskTotalBytes: 1000204886016,
    activityStatus: "available"
  }
});
check("Agent heartbeat reported", heartbeat.status === 200 && heartbeat.data.ok === true, JSON.stringify(heartbeat.data));

// 8. Agent sends software inventory
const inventory = await call("POST", "/api/agent/inventory", {
  auth: `Bearer ${agentToken}`,
  origin: "",
  body: {
    workstationId: wsId,
    software: [
      { name: "Python 3.12", version: "3.12.3", publisher: "Python Software Foundation", source: "windows-registry" },
      { name: "Wireshark", version: "4.2.4", publisher: "The Wireshark Team", source: "windows-registry" },
      { name: "Visual Studio Code", version: "1.89.0", publisher: "Microsoft", source: "windows-registry" },
      { name: "MongoDB Compass", version: "1.42.0", publisher: "MongoDB Inc", source: "windows-registry" }
    ]
  }
});
check("Agent software inventory reported", inventory.status === 200 && inventory.data.detected === 4, JSON.stringify(inventory.data));

// 9. Agent sends metrics
const metrics = await call("POST", "/api/agent/metrics", {
  auth: `Bearer ${agentToken}`,
  origin: "",
  body: {
    workstationId: wsId,
    cpuPercent: 14.5,
    memoryPercent: 42.1,
    diskPercent: 28.0,
    networkStatus: "Connected"
  }
});
check("Agent metrics reported", metrics.status === 200 && metrics.data.ok === true, JSON.stringify(metrics.data));

// 10. Student searches for software "Wireshark"
const studentSearch = await call("GET", "/api/student/workstations?software=wireshark", { cookie: studentCookie });
check("Student finds workstation with Wireshark", studentSearch.status === 200 && studentSearch.data.workstations?.some(w => w.id === wsId));

// 11. Student gets software list
const softwareList = await call("GET", "/api/student/software", { cookie: studentCookie });
check("Student retrieves distinct software list", softwareList.status === 200 && softwareList.data.software?.includes("Wireshark"));

// 12. Admin toggles maintenance
const maintenanceOn = await call("PATCH", `/api/admin/workstations/${wsId}`, {
  cookie: adminCookie,
  body: { maintenance: true, note: "Scheduled RAM upgrade" }
});
check("Admin enables maintenance", maintenanceOn.status === 200 && maintenanceOn.data.workstation?.status === "Maintenance");

const maintenanceOff = await call("PATCH", `/api/admin/workstations/${wsId}`, {
  cookie: adminCookie,
  body: { maintenance: false, note: "" }
});
check("Admin restores maintenance", maintenanceOff.status === 200 && maintenanceOff.data.workstation?.status === "Available");

// 13. Admin Dashboard
const dash = await call("GET", "/api/admin/dashboard", { cookie: adminCookie });
check("Admin dashboard metrics", dash.status === 200 && dash.data.total >= 1 && dash.data.counts?.Available >= 1);

// 14. Admin Reports
const reports = await call("GET", "/api/admin/reports", { cookie: adminCookie });
check("Admin reports view", reports.status === 200 && reports.data.laboratories?.some(l => l.name === "Cybersecurity Lab"));

// 15. Admin Alerts
const alerts = await call("GET", "/api/admin/alerts", { cookie: adminCookie });
check("Admin alerts view", alerts.status === 200 && Array.isArray(alerts.data.alerts));

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
