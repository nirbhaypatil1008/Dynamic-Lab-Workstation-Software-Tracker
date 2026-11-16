import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  workstation_id: { type: String, required: true, index: true },
  kind: { type: String, required: true },
  message: { type: String, required: true },
  created_at: { type: String, required: true, index: true },
  resolved_at: { type: String, default: null, index: true }
}, {
  versionKey: false
});

export const Alert = mongoose.model("Alert", alertSchema);
