import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { Lab } from "../models/Lab.js";
import { Software } from "../models/Software.js";
import { getAllPublicWorkstations, now } from "../helpers.js";

const router = Router();

router.use(requireRole("student"));

// GET /api/student/labs
router.get("/labs", async (req, res, next) => {
  try {
    const labs = await Lab.find({}, { name: 1, room: 1, _id: 0 }).sort({ name: 1 }).lean();
    return res.json({ labs });
  } catch (err) {
    next(err);
  }
});

// GET /api/student/workstations
router.get("/workstations", async (req, res, next) => {
  try {
    const q = String(req.query.software || "").trim().toLowerCase();
    const lab = String(req.query.lab || "").trim();
    const os = String(req.query.os || "").trim();

    const allStations = await getAllPublicWorkstations();
    const filtered = allStations
      .filter(station => (!lab || station.lab === lab) && (!os || station.os === os))
      .filter(station => !q || (station.inventoryFreshness === "Fresh" && station.software.some(item => `${item.name} ${item.version}`.toLowerCase().includes(q))));

    return res.json({ workstations: filtered, serverTime: now() });
  } catch (err) {
    next(err);
  }
});

// GET /api/student/software
router.get("/software", async (req, res, next) => {
  try {
    const softwareNames = await Software.distinct("name");
    softwareNames.sort();
    return res.json({ software: softwareNames });
  } catch (err) {
    next(err);
  }
});

export default router;
