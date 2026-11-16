import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: String, required: true }
}, {
  versionKey: false
});

export const Setting = mongoose.model("Setting", settingSchema);
