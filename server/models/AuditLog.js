import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, default: null, index: true },
  action: { type: String, required: true },
  detail: { type: String, required: true },
  created_at: { type: String, required: true }
}, {
  versionKey: false
});

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
