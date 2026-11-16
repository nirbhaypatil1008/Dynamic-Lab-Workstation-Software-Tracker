import mongoose from "mongoose";

const metricSchema = new mongoose.Schema({
  workstation_id: { type: String, required: true, unique: true, index: true },
  cpu_percent: { type: Number, default: null },
  memory_percent: { type: Number, default: null },
  disk_percent: { type: Number, default: null },
  network_status: { type: String, default: "unknown" },
  reported_at: { type: String, required: true }
}, {
  versionKey: false
});

export const Metric = mongoose.model("Metric", metricSchema);
