import express from "express";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getTasksByTeam,
  getTasksByUser,
  getTasksByProject,
  assignTaskToTeamMember,
  getUnassignedTeamTasks,
  getUnassignedProjectTasks,
} from "../controllers/taskController.js";
import { auth, teamLeaderTaskAuth } from "../middleware/auth.js";

const router = express.Router();

// Main task routes
router.get("/", auth, getTasks);
router.post("/", auth, createTask);
router.put("/:id", auth, updateTask);
router.delete("/:id", auth, deleteTask);

// Get tasks by team - can be filtered with ?status=completed&projectId=xxx
router.get("/team/:teamId", auth, getTasksByTeam);

// Get tasks by project - can be filtered with ?status=completed&assignedTo=xxx
router.get("/project/:projectId", auth, getTasksByProject);

// Get tasks by user - can be filtered with ?status=completed&projectId=xxx
router.get("/user/:userId", auth, getTasksByUser);

// New route for team leaders to assign tasks to team members
router.put(
  "/assign/:taskId/to/:userId",
  auth,
  teamLeaderTaskAuth,
  assignTaskToTeamMember
);

// New route to get tasks assigned to a team but not to a specific member
router.get("/team/:teamId/unassigned", auth, getUnassignedTeamTasks);

// New route to get tasks assigned to a project but not to a specific member
router.get(
  "/project/:projectId/unassigned",
  auth,
  getUnassignedProjectTasks
);

export default router;
