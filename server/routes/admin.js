import { Router } from "express";
import { randomBytes } from "node:crypto";
import { requireRole } from "../middleware/auth.js";
import { Workstation } from "../models/Workstation.js";
import { Lab } from "../models/Lab.js";
import { Alert } from "../models/Alert.js";
import { User } from "../models/User.js";
import { Setting } from "../models/Setting.js";
import {
  now,
  newId,
  sha256,
  audit,
  syncSystemAlerts,
  getAllPublicWorkstations,
  statusFor
} from "../helpers.js";

const router = Router();
const RESET_CODE_TTL_MS = 30 * 60 * 1000;

router.use(requireRole("admin"));

// GET /api/admin/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    await syncSystemAlerts();
    const workstations = await getAllPublicWorkstations();
    const counts = {
      Available: 0,
      "In use": 0,
      Idle: 0,
      Offline: 0,
      Maintenance: 0,
      Unknown: 0
    };

    for (const ws of workstations) {
      if (counts[ws.status] !== undefined) {
        counts[ws.status]++;
      } else {
        counts.Unknown++;
      }
    }

    const staleInventory = workstations.filter(ws => ws.inventoryFreshness === "Stale").length;
    const openAlerts = await Alert.countDocuments({ resolved_at: null });

    return res.json({
      total: workstations.length,
      counts,
      staleInventory,
      openAlerts
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/workstations
router.get("/workstations", async (req, res, next) => {
  try {
    await syncSystemAlerts();
    const workstations = await getAllPublicWorkstations();
    return res.json({ workstations });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/workstations
router.post("/workstations", async (req, res, next) => {
  try {
    const body = req.body || {};
    const id = String(body.id || "").trim().toUpperCase();
    const labName = String(body.lab || "").trim();

    if (!/^[A-Z0-9-]{2,32}$/.test(id) || !labName) {
      return res.status(400).json({ error: "Provide a workstation ID (letters, numbers, hyphens) and lab name." });
    }

    const existing = await Workstation.findOne({ id }).lean();
    if (existing) {
      return res.status(409).json({ error: "That workstation ID is already registered." });
    }

    let lab = await Lab.findOne({ name: new RegExp(`^${labName}$`, "i") });
    if (!lab) {
      lab = await Lab.create({
        id: newId(),
        name: labName,
        room: String(body.room || "").trim(),
        created_at: now()
      });
    }

    const agentToken = randomBytes(32).toString("base64url");
    await Workstation.create({
      id,
      hostname: "",
      lab_id: lab.id,
      os: "",
      agent_token_hash: sha256(agentToken),
      created_at: now()
    });

    await audit(req.user.id, "workstation.create", id);

    return res.status(201).json({
      workstationId: id,
      agentToken,
      warning: "Copy the agent token now. It cannot be retrieved later."
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That workstation ID is already registered." });
    }
    next(err);
  }
});

// POST /api/admin/workstations/:id/rotate-token
router.post("/workstations/:id/rotate-token", async (req, res, next) => {
  try {
    const workstationId = decodeURIComponent(req.params.id);
    const station = await Workstation.findOne({ id: workstationId });
    if (!station) {
      return res.status(404).json({ error: "Workstation not found." });
    }

    const agentToken = randomBytes(32).toString("base64url");
    station.agent_token_hash = sha256(agentToken);
    await station.save();

    await audit(req.user.id, "workstation.agent_token.rotate", station.id);

    return res.json({
      workstationId: station.id,
      agentToken,
      warning: "The previous token is revoked. Copy the new token now; it cannot be retrieved later."
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/workstations/:id
router.patch("/workstations/:id", async (req, res, next) => {
  try {
    const workstationId = decodeURIComponent(req.params.id);
    const body = req.body || {};
    const station = await Workstation.findOne({ id: workstationId });
    if (!station) {
      return res.status(404).json({ error: "Workstation not found." });
    }

    if (typeof body.maintenance !== "boolean") {
      return res.status(400).json({ error: "Specify maintenance as true or false." });
    }

    station.maintenance = body.maintenance;
    station.maintenance_note = body.maintenance ? String(body.note || "").trim() : "";
    await station.save();

    await audit(
      req.user.id,
      body.maintenance ? "workstation.maintenance" : "workstation.restored",
      `${station.id}: ${String(body.note || "")}`
    );

    const allStations = await getAllPublicWorkstations();
    const updated = allStations.find(s => s.id === station.id);

    return res.json({ workstation: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find(
      {},
      { id: 1, name: 1, email: 1, identifier: 1, role: 1, department: 1, created_at: 1, _id: 0 }
    ).sort({ role: 1, name: 1 }).lean();

    return res.json({ users });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/reset-code
router.post("/users/:id/reset-code", async (req, res, next) => {
  try {
    const userId = decodeURIComponent(req.params.id);
    const account = await User.findOne({ id: userId }).lean();
    if (!account) {
      return res.status(404).json({ error: "Account not found." });
    }

    const code = randomBytes(6).toString("hex");
    await Setting.findOneAndUpdate(
      { key: `password_reset:${account.id}` },
      { value: JSON.stringify({ codeHash: sha256(code), expiresAt: Date.now() + RESET_CODE_TTL_MS }) },
      { upsert: true }
    );

    await audit(req.user.id, "admin.password_reset_code", `Reset code issued for ${account.email}`);

    return res.json({
      userId: account.id,
      name: account.name,
      email: account.email,
      code,
      expiresInMinutes: RESET_CODE_TTL_MS / 60000,
      warning: "Share this code with the account owner through an approved channel. It expires and can be shown only once."
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/alerts
router.get("/alerts", async (req, res, next) => {
  try {
    await syncSystemAlerts();
    const alerts = await Alert.find(
      {},
      { id: 1, workstationId: "$workstation_id", kind: 1, message: 1, createdAt: "$created_at", resolvedAt: "$resolved_at", _id: 0 }
    ).sort({ created_at: -1 }).limit(200).lean();

    return res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reports
router.get("/reports", async (req, res, next) => {
  try {
    const [labs, allStations] = await Promise.all([
      Lab.find().sort({ name: 1 }).lean(),
      getAllPublicWorkstations()
    ]);

    const laboratories = labs.map(lab => {
      const labStations = allStations.filter(s => s.lab === lab.name);
      return {
        name: lab.name,
        total: labStations.length,
        available: labStations.filter(s => s.status === "Available").length
      };
    });

    return res.json({
      generatedAt: now(),
      historicalUsage: null,
      laboratories
    });
  } catch (err) {
    next(err);
  }
});

export default router;
