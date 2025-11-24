import User from "../models/User.js";
import Team from "../models/Team.js";
import Task from "../models/Task.js";
import Equipment from "../models/Equipment.js";
import mongoose from "mongoose";

export const getAdminStats = async (req, res) => {
  try {
    // Apply date filtering if provided
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : null;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : null;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateFilter = { createdAt: { $gte: startDate } };
    } else if (endDate) {
      dateFilter = { createdAt: { $lte: endDate } };
    }

    // Aggregate counts for all main data models
    const userCount = await User.countDocuments({
      ...dateFilter,
      isDeleted: false,
    });
    const teamCount = await Team.countDocuments(dateFilter);
    const taskCount = await Task.countDocuments(dateFilter);
    const equipmentCount = await Equipment.countDocuments(dateFilter);

    // Get users by role
    const adminCount = await User.countDocuments({
      ...dateFilter,
      role: "admin",
      isDeleted: false,
    });
    const teamLeaderCount = await User.countDocuments({
      ...dateFilter,
      role: "team_leader",
      isDeleted: false,
    });
    const regularUserCount = await User.countDocuments({
      ...dateFilter,
      role: "user",
      isDeleted: false,
    });
    const teamMemberCount = await User.countDocuments({
      ...dateFilter,
      role: "team_member",
      isDeleted: false,
    });

    // Get deleted users count
    const deletedUserCount = await User.countDocuments({
      isDeleted: true,
    });

    // Get task stats
    const taskStatusFilter = { ...dateFilter };
    const completedTaskCount = await Task.countDocuments({
      ...taskStatusFilter,
      status: "completed",
    });
    const inProgressTaskCount = await Task.countDocuments({
      ...taskStatusFilter,
      status: "in_progress",
    });
    const pendingTaskCount = await Task.countDocuments({
      ...taskStatusFilter,
      status: "pending",
    });

    // Tasks by priority
    const highPriorityTasks = await Task.countDocuments({
      ...taskStatusFilter,
      priority: "high",
    });
    const mediumPriorityTasks = await Task.countDocuments({
      ...taskStatusFilter,
      priority: "medium",
    });
    const lowPriorityTasks = await Task.countDocuments({
      ...taskStatusFilter,
      priority: "low",
    });

    // Get equipment stats
    const availableEquipmentCount = await Equipment.countDocuments({
      ...dateFilter,
      status: "available",
    });
    const assignedEquipmentCount = await Equipment.countDocuments({
      ...dateFilter,
      status: "assigned",
    });
    const maintenanceEquipmentCount = await Equipment.countDocuments({
      ...dateFilter,
      status: "maintenance",
    });

    // Tasks completed by team
    const tasksByTeam = await Task.aggregate([
      { $match: { ...taskStatusFilter } },
      {
        $group: {
          _id: "$teamId",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "teams",
          localField: "_id",
          foreignField: "_id",
          as: "teamInfo",
        },
      },
      {
        $unwind: {
          path: "$teamInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          teamName: "$teamInfo.name",
          totalTasks: 1,
          completedTasks: 1,
          completionRate: {
            $multiply: [
              {
                $divide: [
                  "$completedTasks",
                  {
                    $cond: [
                      { $eq: ["$totalTasks", 0] },
                      1,
                      "$totalTasks",
                    ],
                  },
                ],
              },
              100,
            ],
          },
        },
      },
    ]);

    // Most productive team members (by completed tasks)
    const topTeamMembers = await Task.aggregate([
      {
        $match: {
          ...taskStatusFilter,
          status: "completed",
          assignedTo: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          completedTasks: { $sum: 1 },
        },
      },
      { $sort: { completedTasks: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          name: "$userInfo.name",
          email: "$userInfo.email",
          completedTasks: 1,
        },
      },
    ]);

    // Tasks completed over time (last 7 days)
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - i);
      return {
        date: date.toISOString().split("T")[0],
        timestamp: date,
      };
    }).reverse();

    const tasksCompletedByDay = await Task.aggregate([
      {
        $match: {
          status: "completed",
          completedAt: {
            $gte: new Date(
              last7Days[0].timestamp.setHours(0, 0, 0, 0)
            ),
            $lte: new Date(today.setHours(23, 59, 59, 999)),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days
    const tasksTimelineData = last7Days.map((day) => {
      const match = tasksCompletedByDay.find(
        (item) => item._id === day.date
      );
      return {
        date: day.date,
        count: match ? match.count : 0,
      };
    });

    // Return all stats
    res.json({
      users: {
        total: userCount,
        admins: adminCount,
        teamLeaders: teamLeaderCount,
        teamMembers: teamMemberCount,
        regularUsers: regularUserCount,
        deleted: deletedUserCount,
      },
      teams: {
        total: teamCount,
        performance: tasksByTeam,
      },
      tasks: {
        total: taskCount,
        completed: completedTaskCount,
        inProgress: inProgressTaskCount,
        pending: pendingTaskCount,
        completionRate:
          taskCount > 0
            ? ((completedTaskCount / taskCount) * 100).toFixed(1)
            : 0,
        byPriority: {
          high: highPriorityTasks,
          medium: mediumPriorityTasks,
          low: lowPriorityTasks,
        },
        timeline: tasksTimelineData,
      },
      equipment: {
        total: equipmentCount,
        available: availableEquipmentCount,
        assigned: assignedEquipmentCount,
        maintenance: maintenanceEquipmentCount,
        utilizationRate:
          equipmentCount > 0
            ? (
                (assignedEquipmentCount / equipmentCount) *
                100
              ).toFixed(1)
            : 0,
      },
      topPerformers: topTeamMembers,
      dateFilters: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get stats for a specific team
export const getTeamStats = async (req, res) => {
  try {
    const { teamId } = req.params;

    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Get team member count
    const memberCount = await User.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
      isDeleted: false,
    });

    // Get task stats for this team
    const totalTasks = await Task.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
    });
    const completedTasks = await Task.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
      status: "completed",
    });
    const inProgressTasks = await Task.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
      status: "in_progress",
    });
    const pendingTasks = await Task.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
      status: "pending",
    });

    // Get equipment assigned to this team
    const assignedEquipment = await Equipment.countDocuments({
      teamId: new mongoose.Types.ObjectId(teamId),
    });

    // Get tasks by member
    const tasksByMember = await Task.aggregate([
      { $match: { teamId: new mongoose.Types.ObjectId(teamId) } },
      {
        $group: {
          _id: "$assignedTo",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          userName: { $ifNull: ["$userInfo.name", "Unassigned"] },
          userId: "$_id",
          totalTasks: 1,
          completedTasks: 1,
          completionRate: {
            $multiply: [
              {
                $divide: [
                  "$completedTasks",
                  {
                    $cond: [
                      { $eq: ["$totalTasks", 0] },
                      1,
                      "$totalTasks",
                    ],
                  },
                ],
              },
              100,
            ],
          },
        },
      },
    ]);

    res.json({
      team: {
        id: team._id,
        name: team.name,
        description: team.description,
        memberCount,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        completionRate:
          totalTasks > 0
            ? ((completedTasks / totalTasks) * 100).toFixed(1)
            : 0,
      },
      memberPerformance: tasksByMember,
      equipment: {
        assigned: assignedEquipment,
      },
    });
  } catch (error) {
    console.error("Error fetching team stats:", error);
    res.status(500).json({ message: error.message });
  }
};
