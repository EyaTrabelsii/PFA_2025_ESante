import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import User from "../models/User.js";

// Get all projects with filtering and pagination
export const getProjects = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      teamId,
      status,
      priority,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      dateField,
      startDate,
      endDate,
    } = req.query;

    // Build filter object
    const filter = {};

    if (teamId) filter.teamId = teamId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Add date filtering
    if (dateField && (startDate || endDate)) {
      const dateFilter = {};

      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }

      if (endDate) {
        // Add one day to include the end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        dateFilter.$lt = endDateTime;
      }

      // Apply date filter to the specified field
      if (dateField === "createdAt" || dateField === "updatedAt") {
        filter[dateField] = dateFilter;
      } else if (
        dateField === "startDate" ||
        dateField === "endDate" ||
        dateField === "deadline"
      ) {
        filter[dateField] = dateFilter;
      }
    }

    const skip = (page - 1) * limit;

    let projects;
    let total;

    // For team leaders, prioritize their own team's projects
    if (req.user.role === "team_leader") {
      // Get own team projects first
      const ownTeamFilter = { ...filter, teamId: req.user.teamId };
      const ownTeamProjects = await Project.find(ownTeamFilter)
        .populate({
          path: "teamId",
          select: "name description members",
          populate: {
            path: "members.user",
            select: "name email avatar profilePictureUrl",
          },
        })
        .populate(
          "projectManager",
          "name email avatar profilePictureUrl"
        )
        .populate({
          path: "tasks",
          select: "title status priority assignedTo dueDate",
          populate: {
            path: "assignedTo",
            select: "name email avatar profilePictureUrl",
          },
        })
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 });

      // Get other teams' projects
      const otherTeamsFilter = {
        ...filter,
        teamId: { $ne: req.user.teamId },
      };
      const otherTeamProjects = await Project.find(otherTeamsFilter)
        .populate({
          path: "teamId",
          select: "name description members",
          populate: {
            path: "members.user",
            select: "name email avatar profilePictureUrl",
          },
        })
        .populate(
          "projectManager",
          "name email avatar profilePictureUrl"
        )
        .populate({
          path: "tasks",
          select: "title status priority assignedTo dueDate",
          populate: {
            path: "assignedTo",
            select: "name email avatar profilePictureUrl",
          },
        })
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 });

      // Combine projects with own team first
      const allProjects = [...ownTeamProjects, ...otherTeamProjects];

      // Apply pagination to the combined results
      projects = allProjects.slice(skip, skip + parseInt(limit));
      total = allProjects.length;
    } else {
      // For admins, show all projects normally
      projects = await Project.find(filter)
        .populate({
          path: "teamId",
          select: "name description members",
          populate: {
            path: "members.user",
            select: "name email avatar profilePictureUrl",
          },
        })
        .populate(
          "projectManager",
          "name email avatar profilePictureUrl"
        )
        .populate({
          path: "tasks",
          select: "title status priority assignedTo dueDate",
          populate: {
            path: "assignedTo",
            select: "name email avatar profilePictureUrl",
          },
        })
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      total = await Project.countDocuments(filter);
    }

    // Calculate project statistics and add permission flags
    const projectsWithStats = projects.map((project) => {
      const tasks = project.tasks || [];
      const completedTasks = tasks.filter(
        (task) => task.status === "completed"
      ).length;
      const totalTasks = tasks.length;
      const progress =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : project.progress || 0;

      // Check if user can manage this project
      const canManage =
        req.user.role === "admin" ||
        (req.user.role === "team_leader" &&
          project.teamId._id.toString() ===
            req.user.teamId.toString());

      // Mark if this is the user's own team project
      const isOwnTeam =
        req.user.role === "team_leader" &&
        project.teamId._id.toString() === req.user.teamId.toString();

      return {
        ...project.toObject(),
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          pending: tasks.filter((task) => task.status === "pending")
            .length,
          inProgress: tasks.filter(
            (task) => task.status === "in_progress"
          ).length,
          progress,
        },
        permissions: {
          canEdit: canManage,
          canDelete: req.user.role === "admin", // Only admins can delete
          canManageTasks: canManage,
          canView: true, // Everyone can view
          isOwnTeam: isOwnTeam,
        },
      };
    });

    res.json({
      projects: projectsWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get projects for a specific team (for team leaders)
export const getTeamProjects = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { status, search } = req.query;

    const filter = { teamId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const projects = await Project.find(filter)
      .populate(
        "projectManager",
        "name email avatar profilePictureUrl"
      )
      .populate({
        path: "tasks",
        populate: {
          path: "assignedTo",
          select: "name email avatar profilePictureUrl",
        },
      })
      .sort({ createdAt: -1 });

    // Add task statistics
    const projectsWithStats = projects.map((project) => {
      const tasks = project.tasks || [];
      const completedTasks = tasks.filter(
        (task) => task.status === "completed"
      ).length;
      const totalTasks = tasks.length;

      return {
        ...project.toObject(),
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          pending: tasks.filter((task) => task.status === "pending")
            .length,
          inProgress: tasks.filter(
            (task) => task.status === "in_progress"
          ).length,
          progress:
            totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0,
        },
      };
    });

    res.json(projectsWithStats);
  } catch (error) {
    console.error("Error fetching team projects:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get single project by ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate({
        path: "teamId",
        select: "name description members",
        populate: {
          path: "members.user",
          select: "name email avatar profilePictureUrl phone",
        },
      })
      .populate(
        "projectManager",
        "name email avatar profilePictureUrl phone"
      )
      .populate({
        path: "tasks",
        populate: {
          path: "assignedTo",
          select: "name email avatar profilePictureUrl phone",
        },
      });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Calculate detailed statistics
    const tasks = project.tasks || [];
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "completed")
        .length,
      pending: tasks.filter((task) => task.status === "pending")
        .length,
      inProgress: tasks.filter(
        (task) => task.status === "in_progress"
      ).length,
      overdue: tasks.filter(
        (task) =>
          task.status !== "completed" &&
          new Date(task.dueDate) < new Date()
      ).length,
    };

    taskStats.progress =
      taskStats.total > 0
        ? Math.round((taskStats.completed / taskStats.total) * 100)
        : 0;

    // Transform team members to match frontend expectations
    const transformedTeam = {
      ...project.teamId.toObject(),
      members: project.teamId.members.map((member) => ({
        _id: member.user._id,
        name: member.user.name,
        email: member.user.email,
        avatar: member.user.avatar,
        profilePictureUrl: member.user.profilePictureUrl,
        phone: member.user.phone,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    };

    // Get team members working on this project
    const assignedMemberIds = [
      ...new Set(
        tasks
          .map((task) => task.assignedTo?._id?.toString())
          .filter(Boolean)
      ),
    ];
    const workingMembers = transformedTeam.members.filter((member) =>
      assignedMemberIds.includes(member._id.toString())
    );

    res.json({
      ...project.toObject(),
      teamId: transformedTeam,
      taskStats,
      workingMembers,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Create new project
export const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      teamId,
      status = "planning",
      priority = "medium",
      startDate,
      endDate,
      deadline,
      projectManager,
      tags,
    } = req.body;

    // Clean up empty string values for ObjectId fields
    const cleanProjectManager =
      projectManager === "" ? null : projectManager;

    // Validate required fields
    if (!name || !description || !teamId) {
      return res.status(400).json({
        message: "Name, description, and team are required",
      });
    }

    // If user is a team leader, ensure they can only create projects for their team
    if (req.user.role === "team_leader") {
      if (teamId !== req.user.teamId.toString()) {
        return res.status(403).json({
          message:
            "Team leaders can only create projects for their own team",
        });
      }
    }

    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Find the team leader for this team
    const teamLeader = await User.findOne({
      teamId: teamId,
      role: "team_leader",
      isDeleted: false,
    });

    // Automatically assign team leader as project manager if no specific manager is provided
    let finalProjectManager = cleanProjectManager;
    if (!finalProjectManager && teamLeader) {
      finalProjectManager = teamLeader._id;
    }

    // Verify project manager is part of the team (if provided)
    if (finalProjectManager) {
      const isManagerInTeam = team.members.some(
        (member) =>
          member.user.toString() === finalProjectManager.toString()
      );
      if (!isManagerInTeam) {
        return res.status(400).json({
          message:
            "Project manager must be a member of the assigned team",
        });
      }
    }

    const project = new Project({
      name,
      description,
      teamId,
      status,
      priority,
      startDate: startDate || new Date(),
      endDate,
      deadline,
      projectManager: finalProjectManager,
      tags: tags || [],
    });

    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate("teamId", "name description")
      .populate(
        "projectManager",
        "name email avatar profilePictureUrl"
      );

    res.status(201).json(populatedProject);
  } catch (error) {
    console.error("Error creating project:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Clean up empty string values for ObjectId fields
    if (updates.projectManager === "") {
      updates.projectManager = null;
    }
    if (updates.teamId === "") {
      updates.teamId = null;
    }

    // Verify project exists
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // If user is a team leader, ensure they can only update projects from their team
    if (req.user.role === "team_leader") {
      if (project.teamId.toString() !== req.user.teamId.toString()) {
        return res.status(403).json({
          message:
            "Team leaders can only update projects assigned to their team",
        });
      }

      // Team leaders cannot change the team assignment
      if (
        updates.teamId &&
        updates.teamId !== project.teamId.toString()
      ) {
        return res.status(403).json({
          message:
            "Team leaders cannot reassign projects to other teams",
        });
      }
    }

    // If updating team, verify new team exists and auto-assign team leader
    if (
      updates.teamId &&
      updates.teamId !== project.teamId.toString()
    ) {
      const team = await Team.findById(updates.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Find the team leader for the new team
      const teamLeader = await User.findOne({
        teamId: updates.teamId,
        role: "team_leader",
        isDeleted: false,
      });

      // Auto-assign team leader as project manager if no specific manager is provided
      if (!updates.projectManager && teamLeader) {
        updates.projectManager = teamLeader._id;
      }
    }

    // If no project manager is specified but we're not changing teams,
    // auto-assign the current team's leader if there isn't already a manager
    if (updates.projectManager === null && !project.projectManager) {
      const teamId = updates.teamId || project.teamId;
      const teamLeader = await User.findOne({
        teamId: teamId,
        role: "team_leader",
        isDeleted: false,
      });

      if (teamLeader) {
        updates.projectManager = teamLeader._id;
      }
    }

    // If updating project manager, verify they're in the team
    if (updates.projectManager) {
      const teamId = updates.teamId || project.teamId;
      const team = await Team.findById(teamId);
      const isManagerInTeam = team.members.some(
        (member) =>
          member.user.toString() === updates.projectManager.toString()
      );
      if (!isManagerInTeam) {
        return res.status(400).json({
          message:
            "Project manager must be a member of the assigned team",
        });
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate("teamId", "name description")
      .populate(
        "projectManager",
        "name email avatar profilePictureUrl"
      );

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Delete project
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Only admins can delete projects
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can delete projects",
      });
    }

    // Count tasks that will be deleted
    const taskCount = await Task.countDocuments({ projectId: id });

    // Delete all tasks associated with this project
    if (taskCount > 0) {
      await Task.deleteMany({ projectId: id });
      console.log(
        `Deleted ${taskCount} tasks associated with project ${id}`
      );
    }

    // Delete the project
    await Project.findByIdAndDelete(id);

    res.json({
      message: "Project deleted successfully",
      deletedTasks: taskCount,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get project statistics
export const getProjectStats = async (req, res) => {
  try {
    const { teamId } = req.query;

    const filter = teamId ? { teamId } : {};

    const stats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          planning: {
            $sum: { $cond: [{ $eq: ["$status", "planning"] }, 1, 0] },
          },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          onHold: {
            $sum: { $cond: [{ $eq: ["$status", "on-hold"] }, 1, 0] },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          avgProgress: { $avg: "$progress" },
        },
      },
    ]);

    const result = stats[0] || {
      total: 0,
      planning: 0,
      active: 0,
      onHold: 0,
      completed: 0,
      cancelled: 0,
      avgProgress: 0,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching project stats:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
