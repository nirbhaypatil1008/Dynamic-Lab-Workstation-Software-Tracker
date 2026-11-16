import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  identifier: { type: String, required: true, unique: true, trim: true, index: true },
  role: { type: String, required: true, enum: ["student", "admin"] },
  password_salt: { type: String, default: "" },
  password_hash: { type: String, required: true },
  department: { type: String, default: "", trim: true },
  phone: { type: String, default: "", trim: true },
  semester: { type: String, default: "", trim: true },
  section: { type: String, default: "", trim: true },
  created_at: { type: String, required: true }
}, {
  versionKey: false
});

export const User = mongoose.model("User", userSchema);
