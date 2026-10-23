const BASE = "http://127.0.0.1:3099";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";
let pass = 0, fail = 0;

function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail}`); }
}

async function call(method, path, { body, cookie, origin = ORIGIN } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  const setCookie = res.headers.get("set-cookie") || "";
  const jar = setCookie ? setCookie.split(";")[0] : "";
  return { status: res.status, data, cookie: jar };
}

// 1. Admin setup
const admin = await call("POST", "/api/auth/setup-admin", { body: { name: "Admin One", email: "admin@test.edu", employeeId: "EMP-1", department: "IT", setupToken: "test-setup-token-123456", password: "AdminPassw0rd123", confirmPassword: "AdminPassw0rd123" } });
check("setup-admin creates administrator", [200, 201].includes(admin.status) && admin.data.user?.role === "admin", JSON.stringify(admin.data));

// 2. Origin check
const evil = await call("POST", "/api/auth/login", { body: { identifier: "admin@test.edu", password: "AdminPassw0rd123" }, origin: "https://evil.example" });
check("foreign origin rejected 403", evil.status === 403, `got ${evil.status}`);

// 3. Student registration
const student = await call("POST", "/api/auth/register", { body: { name: "Student One", email: "student@test.edu", usn: "1RV22CS001", phone: "9876543210", department: "CSE", semester: "5", section: "A", password: "StudentPassw0rd123", confirmPassword: "StudentPassw0rd123" } });
check("student registration", [200, 201].includes(student.status) && student.data.user?.role === "student", JSON.stringify(student.data));
const studentId = student.data.user?.id;

// 4. Profile validation + update
const badPhone = await call("PATCH", "/api/auth/profile", { cookie: student.cookie, body: { name: "Student One", phone: "12" } });
check("profile rejects short phone 400", badPhone.status === 400, `got ${badPhone.status}`);
const profile = await call("PATCH", "/api/auth/profile", { cookie: student.cookie, body: { name: "Student Renamed", phone: "9876543211", department: "CSE", semester: "6", section: "B" } });
check("profile update persists", profile.status === 200 && profile.data.user?.name === "Student Renamed" && profile.data.user?.semester === "6", JSON.stringify(profile.data));
const meAfterProfile = await call("GET", "/api/auth/me", { cookie: student.cookie });
check("profile change visible after refresh", meAfterProfile.data.user?.name === "Student Renamed");

// 5. Change password
const wrongCurrent = await call("POST", "/api/auth/change-password", { cookie: student.cookie, body: { currentPassword: "wrong-password-1", newPassword: "NewStudentPassw0rd1", confirmPassword: "NewStudentPassw0rd1" } });
check("change-password rejects wrong current 403", wrongCurrent.status === 403, `got ${wrongCurrent.status}`);
const weak = await call("POST", "/api/auth/change-password", { cookie: student.cookie, body: { currentPassword: "StudentPassw0rd123", newPassword: "short", confirmPassword: "short" } });
check("change-password rejects weak password 400", weak.status === 400, `got ${weak.status}`);
const changed = await call("POST", "/api/auth/change-password", { cookie: student.cookie, body: { currentPassword: "StudentPassw0rd123", newPassword: "NewStudentPassw0rd1", confirmPassword: "NewStudentPassw0rd1" } });
check("change-password succeeds", changed.status === 200, JSON.stringify(changed.data));
const oldSession = await call("GET", "/api/auth/me", { cookie: student.cookie });
check("old session revoked after password change", oldSession.data.user == null, JSON.stringify(oldSession.data));

// 6. Re-login, admin lists users, issues reset code
const relogin = await call("POST", "/api/auth/login", { body: { identifier: "student@test.edu", password: "NewStudentPassw0rd1" } });
check("login with new password", relogin.status === 200 && Boolean(relogin.cookie), JSON.stringify(relogin.data));
const users = await call("GET", "/api/admin/users", { cookie: admin.cookie });
check("admin lists accounts", users.status === 200 && users.data.users?.length === 2, JSON.stringify(users.data));
const code = await call("POST", `/api/admin/users/${studentId}/reset-code`, { cookie: admin.cookie, body: {} });
check("admin issues reset code", code.status === 200 && typeof code.data.code === "string" && code.data.expiresInMinutes === 30, JSON.stringify(code.data));

// 7. Reset password with code
const badReset = await call("POST", "/api/auth/reset-password", { body: { email: "student@test.edu", code: "000000000000", password: "ResetPassw0rd1234", confirmPassword: "ResetPassw0rd1234" } });
check("reset-password rejects bad code 400", badReset.status === 400, `got ${badReset.status}`);
const reset = await call("POST", "/api/auth/reset-password", { body: { email: "student@test.edu", code: code.data.code, password: "ResetPassw0rd1234", confirmPassword: "ResetPassw0rd1234" } });
check("reset-password with code succeeds", reset.status === 200, JSON.stringify(reset.data));
const sessionAfterReset = await call("GET", "/api/auth/me", { cookie: relogin.cookie });
check("sessions revoked after reset", sessionAfterReset.data.user == null, JSON.stringify(sessionAfterReset.data));
const reuse = await call("POST", "/api/auth/reset-password", { body: { email: "student@test.edu", code: code.data.code, password: "ResetPassw0rd1235", confirmPassword: "ResetPassw0rd1235" } });
check("reset code single-use", reuse.status === 400, `got ${reuse.status}`);

// 8. Logout-all
const loginA = await call("POST", "/api/auth/login", { body: { identifier: "student@test.edu", password: "ResetPassw0rd1234" } });
const logoutAll = await call("POST", "/api/auth/logout-all", { cookie: loginA.cookie, body: {} });
check("logout-all succeeds", logoutAll.status === 200, `got ${logoutAll.status}`);
const afterLogoutAll = await call("GET", "/api/auth/me", { cookie: loginA.cookie });
check("session dead after logout-all", afterLogoutAll.data.user == null, JSON.stringify(afterLogoutAll.data));

// 9. Account deletion safeguards
const lastAdmin = await call("DELETE", "/api/auth/account", { cookie: admin.cookie, body: { password: "AdminPassw0rd123", confirmation: "DELETE" } });
check("last admin cannot be deleted 409", lastAdmin.status === 409, `got ${lastAdmin.status}`);
const loginB = await call("POST", "/api/auth/login", { body: { identifier: "student@test.edu", password: "ResetPassw0rd1234" } });
const wrongConfirm = await call("DELETE", "/api/auth/account", { cookie: loginB.cookie, body: { password: "ResetPassw0rd1234", confirmation: "yes" } });
check("deletion rejects wrong confirmation 400", wrongConfirm.status === 400, `got ${wrongConfirm.status}`);
const wrongPassword = await call("DELETE", "/api/auth/account", { cookie: loginB.cookie, body: { password: "nope-nope-nope", confirmation: "DELETE" } });
check("deletion verifies password 403", wrongPassword.status === 403, `got ${wrongPassword.status}`);
const deleted = await call("DELETE", "/api/auth/account", { cookie: loginB.cookie, body: { password: "ResetPassw0rd1234", confirmation: "DELETE" } });
check("account deletion succeeds", deleted.status === 200, JSON.stringify(deleted.data));
const afterDelete = await call("GET", "/api/auth/me", { cookie: loginB.cookie });
check("no session after deletion", afterDelete.data.user == null, JSON.stringify(afterDelete.data));
const reloginDeleted = await call("POST", "/api/auth/login", { body: { identifier: "student@test.edu", password: "ResetPassw0rd1234" } });
check("deleted account cannot sign in", reloginDeleted.status >= 400, `got ${reloginDeleted.status}`);

// 10. Unauthenticated access to protected endpoints
const noAuth = await call("GET", "/api/admin/users", {});
check("protected admin endpoint requires session", noAuth.status === 401, `got ${noAuth.status}`);
const noAuthProfile = await call("PATCH", "/api/auth/profile", { body: { name: "x", phone: "9876543210" } });
check("profile requires session", noAuthProfile.status === 401, `got ${noAuthProfile.status}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
