import express from 'express';
import { getAdminStats, getTeamStats } from '../controllers/statsController.js';
import { auth, adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Get admin dashboard statistics - protected by admin role
router.get('/admin', auth, adminAuth, getAdminStats);

// Get team-specific statistics - available to admins and team leaders
router.get('/team/:teamId', auth, getTeamStats);

export default router; 