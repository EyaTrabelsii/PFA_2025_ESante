import express from "express";
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  removeTeamMember,
  promoteToTeamLeader,
} from "../controllers/teamController.js";
import { auth, adminAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getTeams);
router.get("/:id", getTeamById);
router.post("/", createTeam);
router.put("/:id", updateTeam);
router.delete("/:id", deleteTeam);
router.delete("/:teamId/members/:userId", removeTeamMember);

// Promote a team member to team leader
router.put(
  "/:teamId/promote/:userId",
  auth,
  adminAuth,
  promoteToTeamLeader
);

export default router;
