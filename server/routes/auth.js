import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { Setting } from "../models/Setting.js";
import {
  now,
  newId,
  sha256,
  passwordHash,
  dummyPasswordHash,
  safeEqual,
  verifyPassword,
  validPassword,
  audit
} from "../helpers.js";

const router = Router();
const sessionTtlSeconds = 12 * 60 * 60;
const RESET_CODE_TTL_MS = 30 * 60 * 1000;

export const cookieConfig = {
  path: "/",
  httpOnly: true,
  sameSite: "strict",
  maxAge: sessionTtlSeconds * 1000,
  secure: process.env.COOKIE_SECURE === "true"
};

const clearCookieConfig = {
  path: "/",
  httpOnly: true,
  sameSite: "strict",
  maxAge: 0,
  secure: process.env.COOKIE_SECURE === "true"
};

// GET /api/auth/me
router.get("/me", (req, res) => {
  return res.json({ user: req.user || null });
});

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const identifier = String(body.usn || "").trim();
    const password = body.password;
    const phone = String(body.phone || "").trim();
    const department = String(body.department || "").trim();
    const semester = String(body.semester || "").trim();
    const section = String(body.section || "").trim();

    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !identifier ||
      !phone ||
      phone.replace(/\D/g, "").length < 7 ||
      !department ||
      !semester ||
      !section
    ) {
      return res.status(400).json({
        error: "Enter your name, valid college email, student USN, valid phone number, department, semester, and section."
      });
    }

    if (password !== body.confirmPassword) {
      return res.status(400).json({ error: "The passwords do not match." });
    }

    if (!validPassword(password)) {
      return res.status(400).json({ error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    }

    const existing = await User.findOne({
      $or: [{ email }, { identifier }]
    }).lean();

    if (existing) {
      return res.status(409).json({ error: "That email or student USN is already registered." });
    }

    const userId = newId();
    const createdUser = await User.create({
      id: userId,
      name,
      email,
      identifier,
      role: "student",
      password_salt: "",
      password_hash: passwordHash(password),
      department,
      phone,
      semester,
      section,
      created_at: now()
    });

    await audit(createdUser.id, "student.register", "Student account created");

    const sessionToken = randomBytes(32).toString("base64url");
    await Session.create({
      token_hash: sha256(sessionToken),
      user_id: createdUser.id,
      expires_at: Math.floor(Date.now() / 1000) + sessionTtlSeconds
    });

    res.cookie("lab_session", sessionToken, cookieConfig);

    return res.status(201).json({
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        identifier: createdUser.identifier,
        role: createdUser.role,
        department: createdUser.department,
        phone: createdUser.phone,
        semester: createdUser.semester,
        section: createdUser.section
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That email or student USN is already registered." });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const body = req.body || {};
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");

    const account = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { identifier: identifier }
      ]
    }).lean();

    const validCredentials = account
      ? verifyPassword(password, account)
      : bcrypt.compareSync(password, dummyPasswordHash);

    if (!validCredentials || !account) {
      return res.status(401).json({ error: "The email/identifier or password is incorrect." });
    }

    const sessionToken = randomBytes(32).toString("base64url");
    await Session.create({
      token_hash: sha256(sessionToken),
      user_id: account.id,
      expires_at: Math.floor(Date.now() / 1000) + sessionTtlSeconds
    });

    await audit(account.id, "auth.login", "Successful login");

    res.cookie("lab_session", sessionToken, cookieConfig);

    return res.json({
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        identifier: account.identifier,
        role: account.role,
        department: account.department || "",
        phone: account.phone || "",
        semester: account.semester || "",
        section: account.section || ""
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/setup-admin
router.post("/setup-admin", async (req, res, next) => {
  try {
    const body = req.body || {};
    const expected = process.env.ADMIN_SETUP_TOKEN;

    const adminExists = await User.findOne({ role: "admin" }).lean();
    if (adminExists) {
      return res.status(409).json({ error: "An administrator has already been created." });
    }

    if (!expected) {
      return res.status(503).json({ error: "Administrator setup is disabled. Configure ADMIN_SETUP_TOKEN on the server." });
    }

    if (!body.setupToken || !safeEqual(sha256(String(body.setupToken)), sha256(expected))) {
      return res.status(403).json({ error: "The administrator setup token is not valid." });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const identifier = String(body.employeeId || "").trim();
    const department = String(body.department || "").trim();

    if (!name || !identifier || !department || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Enter administrator name, institutional email, employee ID, and department or assigned lab."
      });
    }

    if (body.password !== body.confirmPassword) {
      return res.status(400).json({ error: "The passwords do not match." });
    }

    if (!validPassword(body.password)) {
      return res.status(400).json({ error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    }

    const adminId = newId();
    const adminUser = await User.create({
      id: adminId,
      name,
      email,
      identifier,
      role: "admin",
      password_salt: "",
      password_hash: passwordHash(body.password),
      department,
      created_at: now()
    });

    process.env.ADMIN_SETUP_TOKEN = "";
    await audit(adminId, "admin.setup", "Initial administrator provisioned");

    const sessionToken = randomBytes(32).toString("base64url");
    await Session.create({
      token_hash: sha256(sessionToken),
      user_id: adminId,
      expires_at: Math.floor(Date.now() / 1000) + sessionTtlSeconds
    });

    res.cookie("lab_session", sessionToken, cookieConfig);

    return res.status(201).json({
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        identifier: adminUser.identifier,
        role: adminUser.role,
        department: adminUser.department
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That email or employee ID is already registered. Use an unused administrator email and ID." });
    }
    next(err);
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.lab_session;
    if (token) {
      await Session.deleteOne({ token_hash: sha256(token) });
    }
    res.cookie("lab_session", "", clearCookieConfig);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/profile
router.patch("/profile", async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Sign in to continue." });
    }

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const department = String(body.department || "").trim();
    const semester = String(body.semester || "").trim();
    const section = String(body.section || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Enter your full name." });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ error: "Enter a valid phone number (7 to 15 digits)." });
    }

    if (req.user.role === "student" && (!department || !semester || !section)) {
      return res.status(400).json({ error: "Enter your department, semester, and section." });
    }

    const updated = await User.findOneAndUpdate(
      { id: req.user.id },
      { name, phone, department, semester, section },
      { new: true }
    ).lean();

    await audit(req.user.id, "profile.update", "Profile details updated");

    return res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        identifier: updated.identifier,
        role: updated.role,
        department: updated.department,
        phone: updated.phone,
        semester: updated.semester,
        section: updated.section
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post("/change-password", async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Sign in to continue." });
    }

    const body = req.body || {};
    const current = String(body.currentPassword || "");
    const nextPassword = body.newPassword;

    const account = await User.findOne({ id: req.user.id }).lean();
    if (!verifyPassword(current, account)) {
      return res.status(403).json({ error: "The current password is incorrect." });
    }

    if (nextPassword !== body.confirmPassword) {
      return res.status(400).json({ error: "The new passwords do not match." });
    }

    if (!validPassword(nextPassword)) {
      return res.status(400).json({ error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    }

    if (nextPassword === current) {
      return res.status(400).json({ error: "Choose a password different from your current one." });
    }

    await User.updateOne(
      { id: account.id },
      { password_hash: passwordHash(nextPassword), password_salt: "" }
    );

    // Invalidate all existing sessions
    await Session.deleteMany({ user_id: account.id });
    await audit(account.id, "auth.password_change", "Password changed; all sessions revoked");

    const sessionToken = randomBytes(32).toString("base64url");
    await Session.create({
      token_hash: sha256(sessionToken),
      user_id: account.id,
      expires_at: Math.floor(Date.now() / 1000) + sessionTtlSeconds
    });

    res.cookie("lab_session", sessionToken, cookieConfig);

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout-all
router.post("/logout-all", async (req, res, next) => {
  try {
    if (req.user) {
      await Session.deleteMany({ user_id: req.user.id });
      await audit(req.user.id, "auth.logout_all", "Signed out of all devices");
    }
    res.cookie("lab_session", "", clearCookieConfig);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();

    if (body.password !== body.confirmPassword) {
      return res.status(400).json({ error: "The passwords do not match." });
    }

    if (!validPassword(body.password)) {
      return res.status(400).json({ error: "Use at least 12 characters with uppercase, lowercase, and a number." });
    }

    const account = await User.findOne({ email }).lean();
    let reset = null;
    if (account) {
      const record = await Setting.findOne({ key: `password_reset:${account.id}` }).lean();
      try {
        reset = record ? JSON.parse(record.value) : null;
      } catch {
        reset = null;
      }
    }

    const codeOk = Boolean(reset && reset.expiresAt > Date.now() && safeEqual(sha256(code), reset.codeHash));
    if (!account || !codeOk) {
      bcrypt.compareSync(code || "invalid", dummyPasswordHash);
      return res.status(400).json({
        error: "The email, reset code, or code expiry is invalid. Ask your administrator for a new code."
      });
    }

    await User.updateOne(
      { id: account.id },
      { password_hash: passwordHash(body.password), password_salt: "" }
    );
    await Setting.deleteOne({ key: `password_reset:${account.id}` });
    await Session.deleteMany({ user_id: account.id });
    await audit(account.id, "auth.password_reset", "Password reset with administrator-issued code");

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/account
router.delete("/account", async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Sign in to continue." });
    }

    const body = req.body || {};
    const account = await User.findOne({ id: req.user.id }).lean();
    if (!verifyPassword(String(body.password || ""), account)) {
      return res.status(403).json({ error: "The password is incorrect. Enter your password to confirm deletion." });
    }

    if (String(body.confirmation || "").trim().toUpperCase() !== "DELETE") {
      return res.status(400).json({ error: "Type DELETE to confirm account deletion." });
    }

    if (account.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(409).json({ error: "This is the only administrator account. Provision another administrator before deleting it." });
      }
    }

    await Setting.deleteOne({ key: `password_reset:${account.id}` });
    await Session.deleteMany({ user_id: account.id });
    await User.deleteOne({ id: account.id });
    await audit(null, "account.delete", "Account removed by its owner");

    res.cookie("lab_session", "", clearCookieConfig);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
