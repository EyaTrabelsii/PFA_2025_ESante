import express from "express";
import {
  getUsers,
  getAllUsersAdmin,
  getDeletedUsers,
  createUser,
  updateUser,
  deleteUser,
  register,
  login,
  purgeDeletedUsers,
  getAvailableUsers,
  getUserById,
  toggleTeamLeaderTaskPermission,
  changePassword,
  restoreUser,
  permanentDeleteUser,
  bulkRestoreUsers,
  bulkPermanentDeleteUsers,
} from "../controllers/userController.js";
import { auth, adminAuth } from "../middleware/auth.js";
import { uploadUserPicture } from "../middleware/upload.js";

const router = express.Router();

// Auth routes
router.post("/register", uploadUserPicture, register);
router.post("/login", login);

// Password change route (requires authentication)
router.put("/password", auth, changePassword);

// Get all active users
router.get("/", getUsers);

// Admin only - get all users including deleted ones
router.get("/all", auth, adminAuth, getAllUsersAdmin);

// Admin only - get only deleted users
router.get("/deleted", auth, adminAuth, getDeletedUsers);

// Admin only - permanently delete soft-deleted users
router.delete("/purge", auth, adminAuth, purgeDeletedUsers);

// Admin only - bulk restore users
router.put("/bulk-restore", auth, adminAuth, bulkRestoreUsers);

// Admin only - bulk permanent delete users
router.delete(
  "/bulk-permanent-delete",
  auth,
  adminAuth,
  bulkPermanentDeleteUsers
);

// Admin only - toggle team leader's permission to manage tasks
router.put(
  "/toggle-task-permission/:userId",
  auth,
  adminAuth,
  toggleTeamLeaderTaskPermission
);

// Get users without teams (available users) - MUST BE BEFORE /:id
router.get("/available", auth, getAvailableUsers);

// Create a new user with optional profile picture
router.post("/", uploadUserPicture, createUser);

// Get a specific user
router.get("/:id", getUserById);

// Update a user with optional profile picture
router.put("/:id", uploadUserPicture, updateUser);

// Admin only - restore a soft-deleted user
router.put("/:id/restore", auth, adminAuth, restoreUser);

// Admin only - permanently delete a specific user
router.delete("/:id/permanent", auth, adminAuth, permanentDeleteUser);

// Delete a user (soft delete)
router.delete("/:id", deleteUser);

export default router;
