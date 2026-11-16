import mongoose from "mongoose";

const workstationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  hostname: { type: String, default: "" },
  lab_id: { type: String, required: true, index: true },
  os: { type: String, default: "" },
  cpu: { type: String, default: "" },
  memory_total_bytes: { type: Number, default: null },
  disk_total_bytes: { type: Number, default: null },
  last_heartbeat: { type: String, default: null },
  last_inventory_scan: { type: String, default: null },
  last_sync: { type: String, default: null },
  activity_status: { type: String, default: "unknown" },
  maintenance: { type: Boolean, default: false },
  maintenance_note: { type: String, default: "" },
  agent_token_hash: { type: String, required: true },
  created_at: { type: String, required: true }
}, {
  versionKey: false
});

export const Workstation = mongoose.model("Workstation", workstationSchema);
