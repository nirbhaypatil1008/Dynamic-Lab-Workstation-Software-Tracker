import mongoose from "mongoose";

const softwareSchema = new mongoose.Schema({
  workstation_id: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  version: { type: String, default: "" },
  publisher: { type: String, default: "" },
  source: { type: String, default: "" },
  detected_at: { type: String, required: true }
}, {
  versionKey: false
});

softwareSchema.index({ workstation_id: 1, name: 1, version: 1 });

export const Software = mongoose.model("Software", softwareSchema);
