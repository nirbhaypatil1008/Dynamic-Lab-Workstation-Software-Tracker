import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { sha256 } from "../helpers.js";

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.lab_session;
    if (!token) {
      req.user = null;
      return next();
    }

    const tokenHash = sha256(token);
    const nowSec = Math.floor(Date.now() / 1000);
    const session = await Session.findOne({ token_hash: tokenHash, expires_at: { $gt: nowSec } }).lean();
    if (!session) {
      req.user = null;
      return next();
    }

    const user = await User.findOne({ id: session.user_id }).lean();
    if (!user) {
      req.user = null;
      return next();
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      identifier: user.identifier,
      role: user.role,
      department: user.department || "",
      phone: user.phone || "",
      semester: user.semester || "",
      section: user.section || ""
    };
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Sign in to continue." });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}
