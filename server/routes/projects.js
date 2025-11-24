import express from "express";
import {
  getProjects,
  getTeamProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from "../controllers/projectController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// GET /api/projects - Get all projects (admin and team leaders can view all)
router.get("/", authorize(["admin", "team_leader"]), getProjects);

// GET /api/projects/stats - Get project statistics
router.get(
  "/stats",
  authorize(["admin", "team_leader"]),
  getProjectStats
);

// GET /api/projects/team/:teamId - Get projects for specific team
router.get(
  "/team/:teamId",
  authorize(["admin", "team_leader"]),
  getTeamProjects
);

// GET /api/projects/:id - Get single project (all authenticated users can view)
router.get("/:id", getProjectById);

// POST /api/projects - Create new project (admin and team leaders, but team leaders only for their team)
router.post("/", authorize(["admin", "team_leader"]), createProject);

// PUT /api/projects/:id - Update project (admin and team leaders, but team leaders only for their team)
router.put(
  "/:id",
  authorize(["admin", "team_leader"]),
  updateProject
);

// DELETE /api/projects/:id - Delete project (admin only)
router.delete("/:id", authorize(["admin"]), deleteProject);

export default router;
 