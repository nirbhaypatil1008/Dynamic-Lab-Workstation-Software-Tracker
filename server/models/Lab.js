import mongoose from "mongoose";

const labSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true, trim: true },
  room: { type: String, default: "", trim: true },
  created_at: { type: String, required: true }
}, {
  versionKey: false
});

export const Lab = mongoose.model("Lab", labSchema);
