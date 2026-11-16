import mongoose from "mongoose";

export async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lab_workstation_tracker";
  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

export async function closeDB() {
  await mongoose.disconnect();
}
