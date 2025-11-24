import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Task from "../models/Task.js";
import Equipment from "../models/Equipment.js";

export const getUsers = async (req, res) => {
  try {
    // Only return non-deleted users and include virtual fields
    const users = await User.find({ isDeleted: false }).populate(
      "teamId"
    );
    // Convert to JSON to include virtuals, then parse back to ensure profilePictureUrl is included
    const usersWithVirtuals = users.map((user) => user.toJSON());
    res.json(usersWithVirtuals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users including deleted ones (admin only)
export const getAllUsersAdmin = async (req, res) => {
  try {
    const users = await User.find().populate("teamId");
    // Convert to JSON to include virtuals
    const usersWithVirtuals = users.map((user) => user.toJSON());
    res.json(usersWithVirtuals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get only deleted users (admin only)
export const getDeletedUsers = async (req, res) => {
  try {
    const deletedUsers = await User.find({
      isDeleted: true,
    }).populate("teamId");
    // Convert to JSON to include virtuals
    const usersWithVirtuals = deletedUsers.map((user) =>
      user.toJSON()
    );
    res.json(usersWithVirtuals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    // Handle profile picture upload
    if (req.file) {
      req.body.profilePicture = req.file.filename;
    }

    const user = new User(req.body);
    const savedUser = await user.save();
    // Return user with virtual fields included
    res.status(201).json(savedUser.toJSON());
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    // Handle profile picture upload
    if (req.file) {
      req.body.profilePicture = req.file.filename;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    // Return user with virtual fields included
    res.json(updatedUser.toJSON());
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Soft delete a user (mark as deleted)
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user to be marked as deleted
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Mark user as deleted
    user.isDeleted = true;
    await user.save();

    // Clear user assignment from tasks
    await Task.updateMany(
      { assignedTo: userId },
      { $unset: { assignedTo: "" } }
    );

    // Clear user assignment from equipment
    await Equipment.updateMany(
      { assignedTo: userId },
      { $unset: { assignedTo: "" }, status: "available" }
    );

    res.json({
      message: "User marked as deleted and all assignments cleared",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Permanently delete soft-deleted users
export const purgeDeletedUsers = async (req, res) => {
  try {
    const result = await User.deleteMany({ isDeleted: true });
    res.json({
      message: "Permanently deleted users",
      count: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Handle profile picture upload
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: "user",
      phone,
    };

    if (req.file) {
      userData.profilePicture = req.file.filename;
    }

    // Create new user
    const user = new User(userData);
    const savedUser = await user.save();

    // Create token
    const token = jwt.sign(
      { id: savedUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        profilePictureUrl: savedUser.profilePictureUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and is not deleted
    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        teamId: user.teamId,
        canManageTasks: user.canManageTasks,
        avatar: user.avatar,
        profilePictureUrl: user.profilePictureUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get available users (without teams)
export const getAvailableUsers = async (req, res) => {
  try {
    // Find users who are not admins, not deleted, and don't have a teamId
    const availableUsers = await User.find({
      role: { $ne: "admin" },
      isDeleted: false,
      $or: [{ teamId: { $exists: false } }, { teamId: null }],
    }).select("_id name email phone role avatar profilePicture");

    // Convert to JSON to include virtuals
    const usersWithVirtuals = availableUsers.map((user) =>
      user.toJSON()
    );
    res.json(usersWithVirtuals);
  } catch (error) {
    console.error("Error in getAvailableUsers:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Return user with virtual fields included
    res.json(user.toJSON());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle team leader's permission to manage tasks (admin only)
export const toggleTeamLeaderTaskPermission = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is a team leader
    if (user.role !== "team_leader") {
      return res.status(400).json({
        message:
          "Only team leaders can have task permissions modified",
      });
    }

    // Toggle the permission
    user.canManageTasks = !user.canManageTasks;
    await user.save();

    res.json({
      message: `Task management permission ${
        user.canManageTasks ? "granted" : "revoked"
      } for ${user.name}`,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Toggle task permission error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Change password for authenticated user
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Get user ID from auth middleware

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Error updating password" });
  }
};

// Restore a soft-deleted user (admin only)
export const restoreUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the deleted user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isDeleted) {
      return res.status(400).json({ message: "User is not deleted" });
    }

    // Restore the user
    user.isDeleted = false;
    await user.save();

    res.json({
      message: "User restored successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Restore user error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Permanently delete a specific user (admin only)
export const permanentDeleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find and permanently delete the user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User permanently deleted",
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Permanent delete user error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Bulk restore users (admin only)
export const bulkRestoreUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid user IDs provided" });
    }

    // Restore multiple users
    const result = await User.updateMany(
      { _id: { $in: userIds }, isDeleted: true },
      { $set: { isDeleted: false } }
    );

    res.json({
      message: `${result.modifiedCount} users restored successfully`,
      restoredCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk restore users error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Bulk permanent delete users (admin only)
export const bulkPermanentDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid user IDs provided" });
    }

    // Permanently delete multiple users
    const result = await User.deleteMany({
      _id: { $in: userIds },
      isDeleted: true,
    });

    res.json({
      message: `${result.deletedCount} users permanently deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk permanent delete users error:", error);
    res.status(500).json({ message: error.message });
  }
};
