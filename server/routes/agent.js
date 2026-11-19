import { Router } from "express";
import { Workstation } from "../models/Workstation.js";
import { Software } from "../models/Software.js";
import { Metric } from "../models/Metric.js";
import { Enrollment } from "../models/Enrollment.js";
import { now, sha256 } from "../helpers.js";

const router = Router();

// Agent Authentication Middleware
async function authenticateAgent(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const workstationId = req.body?.workstationId;

    if (!token || !workstationId) {
      return res.status(401).json({ error: "Agent credential or workstation identity is invalid." });
    }

    const station = await Workstation.findOne({
      id: workstationId,
      agent_token_hash: sha256(token)
    });

    if (!station || station.revoked) {
      return res.status(401).json({ error: "Agent credential or workstation identity is invalid or has been revoked." });
    }

    req.station = station;
    next();
  } catch (err) {
    next(err);
  }
}

router.use(authenticateAgent);

// POST /api/agent/heartbeat
router.post("/heartbeat", async (req, res, next) => {
  try {
    const body = req.body || {};
    const timestamp = now();
    const os = String(body.os || "").slice(0, 160);
    const cpu = String(body.cpu || "").slice(0, 160);
    const activity = ["available", "in_use", "idle", "unknown"].includes(body.activityStatus)
      ? body.activityStatus
      : "unknown";

    req.station.hostname = String(body.hostname || "").slice(0, 255);
    req.station.os = os;
    req.station.cpu = cpu;
    req.station.memory_total_bytes = Number.isSafeInteger(body.memoryTotalBytes) ? body.memoryTotalBytes : null;
    req.station.disk_total_bytes = Number.isSafeInteger(body.diskTotalBytes) ? body.diskTotalBytes : null;
    req.station.last_heartbeat = timestamp;
    req.station.last_sync = timestamp;
    req.station.activity_status = activity;
    req.station.ip_address = req.ip || req.socket.remoteAddress || req.station.ip_address || "";
    if (body.agentVersion) {
      req.station.agent_version = String(body.agentVersion).slice(0, 32);
    }

    await req.station.save();

    // Mark any active enrollment for this workstation as completed
    await Enrollment.updateMany(
      {
        workstation_id: req.station.id,
        status: { $in: ["pending", "command_executed", "installing", "registering", "claimed"] }
      },
      {
        status: "completed",
        progress_message: "First heartbeat received. Connected & monitoring active!",
        completed_at: timestamp
      }
    );

    return res.json({ ok: true, serverTime: timestamp });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/inventory
router.post("/inventory", async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.software) || body.software.length > 5000) {
      return res.status(400).json({ error: "Software inventory must be an array of at most 5000 applications." });
    }

    const timestamp = now();
    await Software.deleteMany({ workstation_id: req.station.id });

    const docs = [];
    for (const item of body.software) {
      if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
      docs.push({
        workstation_id: req.station.id,
        name: item.name.trim().slice(0, 200),
        version: String(item.version || "").slice(0, 100),
        publisher: String(item.publisher || "").slice(0, 200),
        source: String(item.source || "unknown").slice(0, 100),
        detected_at: timestamp
      });
    }

    if (docs.length > 0) {
      await Software.insertMany(docs);
    }

    req.station.last_inventory_scan = timestamp;
    req.station.last_sync = timestamp;
    await req.station.save();

    return res.json({ ok: true, detected: docs.length, scannedAt: timestamp });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/metrics
router.post("/metrics", async (req, res, next) => {
  try {
    const body = req.body || {};
    const timestamp = now();
    const metricVal = (val) => (Number.isFinite(val) && val >= 0 && val <= 100 ? val : null);

    await Metric.findOneAndUpdate(
      { workstation_id: req.station.id },
      {
        cpu_percent: metricVal(body.cpuPercent),
        memory_percent: metricVal(body.memoryPercent),
        disk_percent: metricVal(body.diskPercent),
        network_status: String(body.networkStatus || "unknown").slice(0, 32),
        reported_at: timestamp
      },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, reportedAt: timestamp });
  } catch (err) {
    next(err);
  }
});

export default router;
