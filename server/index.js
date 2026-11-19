import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { connectDB, closeDB } from "./db.js";
import { authenticate } from "./middleware/auth.js";
import { now } from "./helpers.js";

import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/student.js";
import adminRoutes from "./routes/admin.js";
import agentRoutes from "./routes/agent.js";
import enrollRoutes from "./routes/enroll.js";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const host = process.env.API_HOST || "0.0.0.0";
const defaultOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === defaultOrigin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  return false;
}

// Origin and CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }

  const allowOrigin = origin || defaultOrigin;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return res.sendStatus(204);
  }

  next();
});

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Rate limiting for auth routes
const authAttempts = new Map();
const authLimits = {
  "/api/auth/login": 10,
  "/api/auth/register": 5,
  "/api/auth/setup-admin": 5,
  "/api/auth/change-password": 5,
  "/api/auth/reset-password": 5
};

app.use((req, res, next) => {
  if (process.env.NODE_ENV === "test") return next();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const requestPath = req.path;
  const limit = req.method === "POST" ? authLimits[requestPath] : 0;
  if (limit) {
    const bucket = `${key}:${requestPath}`;
    const entry = authAttempts.get(bucket) || { count: 0, resetAt: Date.now() + 60_000 };
    if (entry.resetAt < Date.now()) {
      entry.count = 0;
      entry.resetAt = Date.now() + 60_000;
    }
    if (entry.count >= limit) {
      return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
    }
    entry.count++;
    authAttempts.set(bucket, entry);
  }
  next();
});

// Session Authentication
app.use(authenticate);

// Health check
app.get("/api/health", (req, res) => {
  return res.json({ status: "ok", serverTime: now() });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/enroll", enrollRoutes);

// Catch-all 404
app.use((req, res) => {
  return res.status(404).json({ error: "API route not found." });
});

// Centralized error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error("Unhandled Error:", err);
  }
  return res.status(status).json({
    error: err.message || "An unexpected server error occurred."
  });
});

// Start Server
async function startServer() {
  await connectDB();
  const server = app.listen(port, host, () => {
    console.log(`Lab Tracker Express API listening on http://${host}:${port}`);
    console.log(`Process ID: ${process.pid}`);
    console.log(`MongoDB URI: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lab_workstation_tracker"}`);
    console.log(`Heartbeat timeout: ${process.env.HEARTBEAT_TIMEOUT_SECONDS || 90}s`);
    console.log(`Initial administrator setup: ${process.env.ADMIN_SETUP_TOKEN ? "configured" : "disabled"}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await closeDB();
      server.close(() => process.exit(0));
    });
  }

  return server;
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
