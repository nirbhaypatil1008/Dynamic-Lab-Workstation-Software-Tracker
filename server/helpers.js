import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuditLog } from "./models/AuditLog.js";
import { Alert } from "./models/Alert.js";
import { Workstation } from "./models/Workstation.js";
import { Lab } from "./models/Lab.js";
import { Metric } from "./models/Metric.js";
import { Software } from "./models/Software.js";

export const now = () => new Date().toISOString();
export const newId = () => randomBytes(16).toString("hex");
export const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
export const passwordHash = (password) => bcrypt.hashSync(password, 12);
export const legacyPasswordHash = (password, salt) => scryptSync(password, salt, 64).toString("hex");
export const dummyPasswordHash = passwordHash(randomBytes(32).toString("hex"));

export const safeEqual = (left, right) => {
  if (!left || !right) return false;
  const a = Buffer.from(String(left), "hex");
  const b = Buffer.from(String(right), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

export function verifyPassword(password, account) {
  if (!account || !account.password_hash) return false;
  if (account.password_hash.startsWith("$2")) {
    return bcrypt.compareSync(password, account.password_hash);
  }
  return safeEqual(legacyPasswordHash(password, account.password_salt || ""), account.password_hash);
}

export function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

export async function audit(userId, action, detail) {
  try {
    await AuditLog.create({
      id: newId(),
      user_id: userId || null,
      action,
      detail,
      created_at: now()
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

export function statusFor(station, metric) {
  const heartbeatTimeout = Number(process.env.HEARTBEAT_TIMEOUT_SECONDS || 90);
  if (station.maintenance) return "Maintenance";
  if (!station.last_heartbeat || Date.now() - Date.parse(station.last_heartbeat) > heartbeatTimeout * 1000) return "Offline";
  if (!metric?.reported_at || Date.now() - Date.parse(metric.reported_at) > 180_000) return "Unknown";
  if (station.activity_status === "in_use") return "In use";
  if (station.activity_status === "idle") return "Idle";
  if (station.activity_status === "available") return "Available";
  return "Unknown";
}

export async function syncSystemAlerts() {
  const workstations = await Workstation.find().lean();
  const metrics = await Metric.find().lean();
  const metricMap = new Map(metrics.map(m => [m.workstation_id, m]));

  const activeKinds = new Set();
  for (const row of workstations) {
    const metric = metricMap.get(row.id);
    const stationStatus = statusFor(row, metric);
    const staleInventory = !row.last_inventory_scan || Date.now() - Date.parse(row.last_inventory_scan) > 15 * 60 * 1000;
    const conditions = [];
    if (stationStatus === "Offline") conditions.push(["offline", "Workstation has missed its heartbeat threshold."]);
    if (staleInventory) conditions.push(["stale_inventory", "Software inventory is stale or has never been reported."]);

    for (const [kind, message] of conditions) {
      const key = `${row.id}:${kind}`;
      activeKinds.add(key);
      const existing = await Alert.findOne({ workstation_id: row.id, kind, resolved_at: null });
      if (!existing) {
        await Alert.create({
          id: newId(),
          workstation_id: row.id,
          kind,
          message,
          created_at: now()
        });
      }
    }
  }

  const activeAlerts = await Alert.find({ resolved_at: null });
  for (const alert of activeAlerts) {
    if ((alert.kind === "offline" || alert.kind === "stale_inventory") && !activeKinds.has(`${alert.workstation_id}:${alert.kind}`)) {
      alert.resolved_at = now();
      await alert.save();
    }
  }
}

export function formatPublicWorkstation(row, lab, metric, softwareList) {
  const stationStatus = statusFor(row, metric);
  const staleInventory = !row.last_inventory_scan || Date.now() - Date.parse(row.last_inventory_scan) > 15 * 60 * 1000;
  return {
    id: row.id,
    hostname: row.hostname || "",
    lab: lab ? lab.name : "",
    room: lab ? lab.room : "",
    status: stationStatus,
    os: row.os || "",
    cpu: row.cpu || "",
    memoryTotalBytes: row.memory_total_bytes,
    diskTotalBytes: row.disk_total_bytes,
    maintenanceNote: row.maintenance_note || "",
    lastHeartbeat: row.last_heartbeat,
    lastInventoryScan: row.last_inventory_scan,
    inventoryFreshness: staleInventory ? "Stale" : "Fresh",
    health: {
      cpuPercent: metric?.cpu_percent ?? null,
      memoryPercent: metric?.memory_percent ?? null,
      diskPercent: metric?.disk_percent ?? null,
      network: metric?.network_status || "Not available",
      reportedAt: metric?.reported_at || null
    },
    software: (softwareList || []).map(s => ({
      name: s.name,
      version: s.version || "",
      publisher: s.publisher || "",
      source: s.source || "",
      detected_at: s.detected_at
    }))
  };
}

export async function getAllPublicWorkstations() {
  const [workstations, labs, metrics, software] = await Promise.all([
    Workstation.find().sort({ id: 1 }).lean(),
    Lab.find().lean(),
    Metric.find().lean(),
    Software.find().sort({ name: 1 }).lean()
  ]);

  const labMap = new Map(labs.map(l => [l.id, l]));
  const metricMap = new Map(metrics.map(m => [m.workstation_id, m]));
  const softwareMap = new Map();
  for (const s of software) {
    if (!softwareMap.has(s.workstation_id)) {
      softwareMap.set(s.workstation_id, []);
    }
    softwareMap.get(s.workstation_id).push(s);
  }

  return workstations.map(row => {
    const lab = labMap.get(row.lab_id);
    const metric = metricMap.get(row.id);
    const soft = softwareMap.get(row.id) || [];
    return formatPublicWorkstation(row, lab, metric, soft);
  });
}
