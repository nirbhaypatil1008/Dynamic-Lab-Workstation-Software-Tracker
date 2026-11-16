import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  token_hash: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  expires_at: { type: Number, required: true, index: true }
}, {
  versionKey: false
});

export const Session = mongoose.model("Session", sessionSchema);
