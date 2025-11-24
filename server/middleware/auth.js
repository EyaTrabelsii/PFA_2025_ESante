import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.id });

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Please authenticate" });
  }
};

// Alternative name for auth (for compatibility)
export const protect = auth;

export const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Access denied. Admin only." });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ message: "Please authenticate" });
  }
};

// Flexible authorization middleware that accepts multiple roles
export const authorize = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Please authenticate" });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Access denied. Required roles: ${roles.join(
            ", "
          )}`,
        });
      }

      next();
    } catch (error) {
      res.status(401).json({ message: "Please authenticate" });
    }
  };
};

// Middleware to verify the user is a team leader with permission to manage tasks
export const teamLeaderTaskAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      // Check if user is a team leader
      if (req.user.role !== "team_leader") {
        return res
          .status(403)
          .json({ message: "Access denied. Team leaders only." });
      }

      // Check if team leader has permission to manage tasks
      if (!req.user.canManageTasks) {
        return res.status(403).json({
          message:
            "Access denied: You do not have permission to manage tasks. Please contact an admin.",
        });
      }

      next();
    });
  } catch (error) {
    res.status(401).json({ message: "Please authenticate" });
  }
};
