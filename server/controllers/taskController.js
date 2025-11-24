import Task from "../models/Task.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import Project from "../models/Project.js";

export const getTasks = async (req, res) => {
  try {
    let query = {};

    // If the user is a team leader (not admin), restrict to only their team's tasks
    if (req.user && req.user.role === "team_leader") {
      query.teamId = req.user.teamId;
    }

    // Handle query parameters for filtering
    if (req.query.teamId) {
      query.teamId = req.query.teamId;
    }
    if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    // Check if the user is a team leader without permission to manage tasks
    if (req.user.role === "team_leader" && !req.user.canManageTasks) {
      return res.status(403).json({
        message:
          "Access denied: You do not have permission to manage tasks. Please contact an admin.",
      });
    }

    // Handle assignedTo field - remove it if it's empty string
    const taskData = { ...req.body };

    // Validate projectId is provided
    if (!taskData.projectId) {
      return res
        .status(400)
        .json({ message: "Project ID is required" });
    }

    // Verify project exists and get team info
    const project = await Project.findById(
      taskData.projectId
    ).populate("teamId");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Set teamId from project
    taskData.teamId = project.teamId._id;

    // If user is a team leader, ensure the task is assigned to their team
    if (req.user.role === "team_leader") {
      if (
        project.teamId._id.toString() !== req.user.teamId.toString()
      ) {
        return res.status(403).json({
          message:
            "Access denied: You can only create tasks for projects in your team",
        });
      }
    }

    // Remove the assignedTo field if it's empty or an empty string
    if (!taskData.assignedTo || taskData.assignedTo === "") {
      delete taskData.assignedTo;
    }

    const task = new Task(taskData);
    const savedTask = await task.save();

    // Populate references and return
    const populatedTask = await Task.findById(savedTask._id)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    // Check if the user is a team leader without permission to manage tasks
    if (req.user.role === "team_leader" && !req.user.canManageTasks) {
      return res.status(403).json({
        message:
          "Access denied: You do not have permission to manage tasks. Please contact an admin.",
      });
    }

    // For team leaders, verify they're only updating tasks from their team
    if (req.user.role === "team_leader") {
      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Team leader can only update tasks from their team
      if (task.teamId.toString() !== req.user.teamId.toString()) {
        return res.status(403).json({
          message:
            "Access denied: You can only update tasks from your team",
        });
      }
    }

    // Handle assignedTo field - remove it if it's empty string
    const updateData = { ...req.body };

    // If projectId is being updated, validate and update teamId
    if (updateData.projectId) {
      const project = await Project.findById(
        updateData.projectId
      ).populate("teamId");
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      updateData.teamId = project.teamId._id;
    }

    // Remove the assignedTo field if it's empty or an empty string
    if (updateData.assignedTo === "") {
      delete updateData.assignedTo;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");
    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    // Check if the user is a team leader without permission to manage tasks
    if (req.user.role === "team_leader" && !req.user.canManageTasks) {
      return res.status(403).json({
        message:
          "Access denied: You do not have permission to manage tasks. Please contact an admin.",
      });
    }

    // For team leaders, verify they're only deleting tasks from their team
    if (req.user.role === "team_leader") {
      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Team leader can only delete tasks from their team
      if (task.teamId.toString() !== req.user.teamId.toString()) {
        return res.status(403).json({
          message:
            "Access denied: You can only delete tasks from your team",
        });
      }
    }

    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by team ID with optional status filter
export const getTasksByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    let query = { teamId };

    // Apply status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Apply project filter if provided
    if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    // If user is a team leader, ensure they only access their own team's tasks
    if (
      req.user.role === "team_leader" &&
      req.user.teamId.toString() !== teamId
    ) {
      return res.status(403).json({
        message:
          "Access denied: You can only view tasks from your team",
      });
    }

    const tasks = await Task.find(query)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by project ID
export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists and get team info
    const project = await Project.findById(projectId).populate(
      "teamId"
    );
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // If user is a team leader, ensure they only access projects from their team
    if (req.user.role === "team_leader") {
      if (
        project.teamId._id.toString() !== req.user.teamId.toString()
      ) {
        return res.status(403).json({
          message:
            "Access denied: You can only view tasks from projects in your team",
        });
      }
    }

    let query = { projectId };

    // Apply status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Apply assignedTo filter if provided
    if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by user ID with optional status filter
export const getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    let query = { assignedTo: userId };

    // Apply status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Apply project filter if provided
    if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    // If user is a team leader, ensure they only access tasks from their team
    if (req.user.role === "team_leader") {
      query.teamId = req.user.teamId;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// New function for team leaders to assign tasks to team members
export const assignTaskToTeamMember = async (req, res) => {
  try {
    const { taskId, userId } = req.params;

    // Find the task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Verify the task belongs to the team leader's team
    if (task.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({
        message:
          "Access denied: You can only assign tasks from your team",
      });
    }

    // Verify the user is a member of the team
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({
        message:
          "Access denied: You can only assign tasks to members of your team",
      });
    }

    // Update the task with the assigned user
    // Make sure we have a valid ObjectId
    if (userId && userId.trim() !== "") {
      task.assignedTo = userId;
    } else {
      // If userId is empty, remove the assignedTo field
      task.assignedTo = undefined;
    }

    // Update the status to in_progress if it was pending
    if (task.status === "pending") {
      task.status = "in_progress";
    }

    await task.save();

    // Return the updated task with populated fields
    const updatedTask = await Task.findById(taskId)
      .populate("assignedTo")
      .populate("teamId")
      .populate("projectId");

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// New function to get unassigned tasks for a team
export const getUnassignedTeamTasks = async (req, res) => {
  try {
    const { teamId } = req.params;

    // If user is a team leader, ensure they only access their own team's tasks
    if (
      req.user.role === "team_leader" &&
      req.user.teamId.toString() !== teamId
    ) {
      return res.status(403).json({
        message:
          "Access denied: You can only view tasks from your team",
      });
    }

    // Find tasks that belong to the team but have no assignedTo value
    // or where assignedTo is null
    const tasks = await Task.find({
      teamId: teamId,
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
    })
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get unassigned tasks for a specific project
export const getUnassignedProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists and get team info
    const project = await Project.findById(projectId).populate(
      "teamId"
    );
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // If user is a team leader, ensure they only access projects from their team
    if (req.user.role === "team_leader") {
      if (
        project.teamId._id.toString() !== req.user.teamId.toString()
      ) {
        return res.status(403).json({
          message:
            "Access denied: You can only view tasks from projects in your team",
        });
      }
    }

    // Find tasks that belong to the project but have no assignedTo value
    const tasks = await Task.find({
      projectId: projectId,
      $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
    })
      .populate("teamId")
      .populate("projectId");

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
