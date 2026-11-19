import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  token_hash: { type: String, required: true, unique: true, index: true },
  created_by_user_id: { type: String, required: true },
  workstation_id: { type: String, default: "" },
  workstation_name: { type: String, default: "" },
  lab_name: { type: String, default: "" },
  room: { type: String, default: "" },
  status: {
    type: String,
    enum: [
      "pending",
      "command_executed",
      "installing",
      "registering",
      "claimed",
      "completed",
      "failed",
      "expired",
      "revoked"
    ],
    default: "pending"
  },
  progress_message: { type: String, default: "Waiting for connection from target computer..." },
  target_hostname: { type: String, default: "" },
  target_os: { type: String, default: "" },
  target_ip: { type: String, default: "" },
  error_message: { type: String, default: "" },
  created_at: { type: String, required: true },
  expires_at: { type: String, required: true },
  claimed_at: { type: String, default: null },
  completed_at: { type: String, default: null }
}, {
  versionKey: false
});

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
