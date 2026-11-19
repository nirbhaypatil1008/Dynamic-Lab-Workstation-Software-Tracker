import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Enrollment } from "../models/Enrollment.js";
import { Workstation } from "../models/Workstation.js";
import { Lab } from "../models/Lab.js";
import { now, newId, sha256, getServerBaseUrl, audit } from "../helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const router = Router();

// Helper to find enrollment by raw token
async function getValidEnrollment(rawToken) {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = sha256(rawToken);
  const enrollment = await Enrollment.findOne({ token_hash: tokenHash });
  if (!enrollment) return null;

  // Check expiration
  if (Date.parse(enrollment.expires_at) <= Date.now()) {
    if (enrollment.status !== "completed" && enrollment.status !== "expired") {
      enrollment.status = "expired";
      enrollment.progress_message = "Enrollment session has expired.";
      await enrollment.save();
    }
  }

  return enrollment;
}

// 1. GET /api/enroll/:token/install.ps1
// Dynamically serves the pre-configured PowerShell installation script
router.get("/:token/install.ps1", async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const enrollment = await getValidEnrollment(rawToken);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    if (!enrollment) {
      return res.status(200).send(`
Write-Host "===========================================================" -ForegroundColor Red
Write-Host "[-] ERROR: Invalid enrollment token." -ForegroundColor Red
Write-Host "[-] Generate a new connection command from Dynamic Lab dashboard." -ForegroundColor Red
Write-Host "===========================================================" -ForegroundColor Red
return
`);
    }

    if (enrollment.status === "expired") {
      return res.status(200).send(`
Write-Host "===========================================================" -ForegroundColor Red
Write-Host "[-] ERROR: This enrollment command has expired." -ForegroundColor Red
Write-Host "[-] Generate a fresh connection command from the Dynamic Lab dashboard." -ForegroundColor Red
Write-Host "===========================================================" -ForegroundColor Red
return
`);
    }

    if (enrollment.status === "revoked") {
      return res.status(200).send(`
Write-Host "===========================================================" -ForegroundColor Red
Write-Host "[-] ERROR: This enrollment session was cancelled or revoked." -ForegroundColor Red
Write-Host "===========================================================" -ForegroundColor Red
return
`);
    }

    // Update status to command_executed
    if (enrollment.status === "pending") {
      enrollment.status = "command_executed";
      enrollment.progress_message = "PowerShell installer received on target machine. Preparing installation...";
      enrollment.target_ip = req.ip || req.socket.remoteAddress || "";
      await enrollment.save();
    }

    const scriptPath = path.join(projectRoot, "agent/installer/install.ps1");
    let scriptContent = fs.readFileSync(scriptPath, "utf-8");

    const baseUrl = getServerBaseUrl(req);

    // Replace placeholders with real values for this session
    scriptContent = scriptContent.replace(/__SERVER_URL__/g, baseUrl);
    scriptContent = scriptContent.replace(/__ENROLLMENT_TOKEN__/g, rawToken);

    return res.send(scriptContent);
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/enroll/:token/progress
// Reports step progress from the running PowerShell installer
router.post("/:token/progress", async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const enrollment = await getValidEnrollment(rawToken);
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment session not found or invalid." });
    }

    if (enrollment.status === "expired" || enrollment.status === "revoked") {
      return res.status(403).json({ error: `Enrollment session is ${enrollment.status}.` });
    }

    const body = req.body || {};
    const step = String(body.step || "").trim();
    const message = String(body.message || "").trim();

    if (["command_executed", "installing", "registering", "completed", "failed"].includes(step)) {
      enrollment.status = step;
    }
    if (message) {
      enrollment.progress_message = message;
    }
    if (step === "failed") {
      enrollment.error_message = message;
    }
    if (step === "completed") {
      enrollment.completed_at = now();
    }

    await enrollment.save();
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/enroll/:token/claim
// Exchanges the single-use enrollment token for permanent device credentials
router.post("/:token/claim", async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const enrollment = await getValidEnrollment(rawToken);
    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment token not found or invalid." });
    }

    if (enrollment.status === "expired") {
      return res.status(410).json({ error: "Enrollment token has expired." });
    }

    if (enrollment.status === "revoked") {
      return res.status(403).json({ error: "Enrollment token has been revoked." });
    }

    if (enrollment.claimed_at) {
      return res.status(409).json({ error: "This single-use enrollment token has already been claimed." });
    }

    const body = req.body || {};
    const hostname = String(body.hostname || "").trim().slice(0, 255);
    const os = String(body.os || "").trim().slice(0, 160);
    const cpu = String(body.cpu || "").trim().slice(0, 160);
    const memoryTotalBytes = Number.isSafeInteger(body.memoryTotalBytes) ? body.memoryTotalBytes : null;
    const diskTotalBytes = Number.isSafeInteger(body.diskTotalBytes) ? body.diskTotalBytes : null;

    // Determine Workstation ID
    let stationId = enrollment.workstation_id;
    if (!stationId) {
      if (hostname) {
        const cleanHost = hostname.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
        stationId = cleanHost.startsWith("PC-") || cleanHost.startsWith("WS-") ? cleanHost : `WS-${cleanHost}`;
      } else {
        stationId = `WS-${randomBytes(3).toString("hex").toUpperCase()}`;
      }
    }

    // Resolve Laboratory
    const labName = enrollment.lab_name || "Main Laboratory";
    let lab = await Lab.findOne({ name: new RegExp(`^${labName}$`, "i") });
    if (!lab) {
      lab = await Lab.create({
        id: newId(),
        name: labName,
        room: enrollment.room || "Room 101",
        created_at: now()
      });
    }

    // Generate permanent random device token
    const deviceToken = randomBytes(32).toString("base64url");
    const deviceTokenHash = sha256(deviceToken);
    const timestamp = now();

    let station = await Workstation.findOne({ id: stationId });
    if (!station) {
      station = await Workstation.create({
        id: stationId,
        hostname: hostname,
        lab_id: lab.id,
        os: os,
        cpu: cpu,
        memory_total_bytes: memoryTotalBytes,
        disk_total_bytes: diskTotalBytes,
        ip_address: req.ip || req.socket.remoteAddress || "",
        agent_version: "1.0.0",
        revoked: false,
        revoked_at: null,
        agent_token_hash: deviceTokenHash,
        created_at: timestamp
      });
    } else {
      station.hostname = hostname;
      station.lab_id = lab.id;
      station.os = os;
      station.cpu = cpu;
      station.memory_total_bytes = memoryTotalBytes;
      station.disk_total_bytes = diskTotalBytes;
      station.ip_address = req.ip || req.socket.remoteAddress || "";
      station.agent_version = "1.0.0";
      station.revoked = false;
      station.revoked_at = null;
      station.agent_token_hash = deviceTokenHash;
      await station.save();
    }

    // Update enrollment status
    enrollment.status = "registering";
    enrollment.claimed_at = timestamp;
    enrollment.workstation_id = station.id;
    enrollment.target_hostname = hostname;
    enrollment.target_os = os;
    enrollment.target_ip = req.ip || req.socket.remoteAddress || "";
    enrollment.progress_message = "Device credential provisioned. Starting monitoring agent...";
    await enrollment.save();

    await audit(enrollment.created_by_user_id, "workstation.enrolled", `Workstation ${station.id} enrolled from ${enrollment.target_ip}`);

    const baseUrl = getServerBaseUrl(req);

    return res.status(200).json({
      workstationId: station.id,
      deviceToken,
      apiUrl: baseUrl
    });
  } catch (err) {
    next(err);
  }
});

// 4. File download endpoints for installer
router.get("/files/monitor.py", (req, res) => {
  const filePath = path.join(projectRoot, "agent/monitor.py");
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(fs.readFileSync(filePath, "utf-8"));
});

router.get("/files/requirements.txt", (req, res) => {
  const filePath = path.join(projectRoot, "agent/requirements.txt");
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(fs.readFileSync(filePath, "utf-8"));
});

router.get("/files/uninstall.ps1", (req, res) => {
  const filePath = path.join(projectRoot, "agent/installer/uninstall.ps1");
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(fs.readFileSync(filePath, "utf-8"));
});

export default router;
