import express from "express";
import {
  register,
  createAdmin,
  createTeamLead,
  login,
  verifyToken,
  resetPassword,
  forgotPassword,
  completePasswordReset,
} from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Register new user
router.post("/register", register);

// Create admin user - special endpoint for testing
router.post("/create-admin", createAdmin);

// Create team leader - special endpoint for testing
router.post("/create-team-lead", createTeamLead);

// Login user
router.post("/login", login);

// Verify token
router.get("/verify", verifyToken);

// Reset password (requires current password)
router.post("/reset-password", auth, resetPassword);

// Forgot password - request a reset link
router.post("/forgot-password", forgotPassword);

// Complete password reset using token
router.post("/complete-reset", completePasswordReset);

export default router;
