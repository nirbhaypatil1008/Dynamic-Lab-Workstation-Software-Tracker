import { Router } from "express";
import { randomBytes } from "node:crypto";
import { requireRole } from "../middleware/auth.js";
import { Workstation } from "../models/Workstation.js";
import { Lab } from "../models/Lab.js";
import { Alert } from "../models/Alert.js";
import { User } from "../models/User.js";
import { Setting } from "../models/Setting.js";
import { Enrollment } from "../models/Enrollment.js";
import { Software } from "../models/Software.js";
import { Metric } from "../models/Metric.js";
import {
  now,
  newId,
  sha256,
  audit,
  syncSystemAlerts,
  getAllPublicWorkstations,
  statusFor,
  getLanIp,
  getServerBaseUrl
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

// DELETE /api/admin/workstations/:id
router.delete("/workstations/:id", async (req, res, next) => {
  try {
    const workstationId = decodeURIComponent(req.params.id);
    const station = await Workstation.findOne({ id: workstationId });
    if (!station) {
      return res.status(404).json({ error: "Workstation not found." });
    }

    await Promise.all([
      Workstation.deleteOne({ id: workstationId }),
      Software.deleteMany({ workstation_id: workstationId }),
      Metric.deleteMany({ workstation_id: workstationId }),
      Alert.deleteMany({ workstationId }),
      Enrollment.deleteMany({ workstation_id: workstationId })
    ]);

    await audit(req.user.id, "workstation.delete", workstationId);

    return res.json({
      ok: true,
      message: `Workstation ${workstationId} and its associated records were deleted successfully.`
    });
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

// GET /api/admin/network-info
router.get("/network-info", (req, res) => {
  const lanIp = getLanIp();
  const baseUrl = getServerBaseUrl(req);
  return res.json({
    lanIp,
    defaultPort: Number(process.env.API_PORT || 3001),
    serverBaseUrl: baseUrl
  });
});

// POST /api/admin/enrollment/generate
router.post("/enrollment/generate", async (req, res, next) => {
  try {
    const body = req.body || {};
    const requestedId = String(body.workstationId || "").trim().toUpperCase();
    const labName = String(body.lab || "").trim() || "Main Laboratory";
    const room = String(body.room || "").trim();
    const customServerUrl = String(body.serverUrl || "").trim();
    const expiresInMinutes = Math.min(60, Math.max(5, Number(body.expiresInMinutes) || 15));

    let finalStationId = requestedId;
    if (!finalStationId) {
      const count = await Workstation.countDocuments();
      finalStationId = `WS-${String(count + 1).padStart(3, "0")}`;
    }

    const rawToken = randomBytes(24).toString("base64url");
    const tokenHash = sha256(rawToken);
    const enrollmentId = newId();
    const timestamp = now();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const baseUrl = customServerUrl || getServerBaseUrl(req);
    const powershellCommand = `& ([scriptblock]::Create((irm '${baseUrl}/api/enroll/${rawToken}/install.ps1')))`;

    await Enrollment.create({
      id: enrollmentId,
      token_hash: tokenHash,
      created_by_user_id: req.user.id,
      workstation_id: finalStationId,
      lab_name: labName,
      room,
      status: "pending",
      progress_message: "Waiting for command execution on target computer...",
      created_at: timestamp,
      expires_at: expiresAt
    });

    await audit(req.user.id, "enrollment.generate", `Generated enrollment for ${finalStationId}`);

    return res.status(201).json({
      enrollmentId,
      workstationId: finalStationId,
      lab: labName,
      room,
      command: powershellCommand,
      serverUrl: baseUrl,
      expiresAt,
      expiresInMinutes,
      status: "pending",
      progressMessage: "Waiting for command execution on target computer..."
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/enrollment/:id/status
router.get("/enrollment/:id/status", async (req, res, next) => {
  try {
    const enrollmentId = req.params.id;
    const enrollment = await Enrollment.findOne({ id: enrollmentId });
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment session not found." });
    }

    if (Date.parse(enrollment.expires_at) <= Date.now() && enrollment.status !== "completed") {
      enrollment.status = "expired";
      enrollment.progress_message = "Enrollment session has expired.";
      await enrollment.save();
    }

    let isOnline = false;
    if (enrollment.workstation_id) {
      const station = await Workstation.findOne({ id: enrollment.workstation_id });
      if (station && station.last_heartbeat) {
        const timeout = Number(process.env.HEARTBEAT_TIMEOUT_SECONDS || 90);
        isOnline = (Date.now() - Date.parse(station.last_heartbeat)) < timeout * 1000;
        if (isOnline && enrollment.status !== "completed") {
          enrollment.status = "completed";
          enrollment.progress_message = "First heartbeat received. Connected & monitoring active!";
          enrollment.completed_at = now();
          await enrollment.save();
        }
      }
    }

    return res.json({
      id: enrollment.id,
      status: enrollment.status,
      progressMessage: enrollment.progress_message,
      errorMessage: enrollment.error_message,
      workstationId: enrollment.workstation_id,
      targetHostname: enrollment.target_hostname,
      targetOs: enrollment.target_os,
      targetIp: enrollment.target_ip,
      isOnline,
      expiresAt: enrollment.expires_at,
      completedAt: enrollment.completed_at
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/enrollment/:id/cancel
router.post("/enrollment/:id/cancel", async (req, res, next) => {
  try {
    const enrollmentId = req.params.id;
    const enrollment = await Enrollment.findOne({ id: enrollmentId });
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment session not found." });
    }

    enrollment.status = "revoked";
    enrollment.progress_message = "Enrollment session was cancelled by administrator.";
    await enrollment.save();

    await audit(req.user.id, "enrollment.cancel", `Cancelled enrollment ${enrollment.id}`);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/workstations/:id/revoke
router.post("/workstations/:id/revoke", async (req, res, next) => {
  try {
    const workstationId = decodeURIComponent(req.params.id);
    const station = await Workstation.findOne({ id: workstationId });
    if (!station) {
      return res.status(404).json({ error: "Workstation not found." });
    }

    station.revoked = true;
    station.revoked_at = now();
    station.agent_token_hash = sha256(randomBytes(32).toString("hex"));
    await station.save();

    await audit(req.user.id, "workstation.revoke", `Revoked workstation ${station.id}`);

    const allStations = await getAllPublicWorkstations();
    const updated = allStations.find(s => s.id === station.id);

    return res.json({ ok: true, workstation: updated, message: "Workstation access has been revoked." });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/workstations/:id/reconnect
router.post("/workstations/:id/reconnect", async (req, res, next) => {
  try {
    const workstationId = decodeURIComponent(req.params.id);
    const station = await Workstation.findOne({ id: workstationId });
    if (!station) {
      return res.status(404).json({ error: "Workstation not found." });
    }

    const lab = await Lab.findOne({ id: station.lab_id });
    const labName = lab ? lab.name : "Main Laboratory";

    const rawToken = randomBytes(24).toString("base64url");
    const tokenHash = sha256(rawToken);
    const enrollmentId = newId();
    const timestamp = now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const baseUrl = getServerBaseUrl(req);
    const powershellCommand = `& ([scriptblock]::Create((irm '${baseUrl}/api/enroll/${rawToken}/install.ps1')))`;

    await Enrollment.create({
      id: enrollmentId,
      token_hash: tokenHash,
      created_by_user_id: req.user.id,
      workstation_id: station.id,
      lab_name: labName,
      room: lab ? lab.room : "",
      status: "pending",
      progress_message: `Waiting for reconnection from ${station.id}...`,
      created_at: timestamp,
      expires_at: expiresAt
    });

    await audit(req.user.id, "workstation.reconnect_command", `Generated reconnection command for ${station.id}`);

    return res.status(201).json({
      enrollmentId,
      workstationId: station.id,
      lab: labName,
      command: powershellCommand,
      serverUrl: baseUrl,
      expiresAt,
      status: "pending"
    });
  } catch (err) {
    next(err);
  }
});

export default router;
