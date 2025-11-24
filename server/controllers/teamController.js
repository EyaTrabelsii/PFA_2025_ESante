import Team from "../models/Team.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Equipment from "../models/Equipment.js";

export const getTeams = async (req, res) => {
  try {
    const teams = await Team.find().populate("members.user");
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single team by ID
export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate(
      "members.user"
    );

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    res.json(team);
  } catch (error) {
    // Handle invalid ID format
    if (error.kind === "ObjectId") {
      return res
        .status(400)
        .json({ message: "Invalid team ID format" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const createTeam = async (req, res) => {
  try {
    const { memberIds, teamLeaderId, ...teamData } = req.body;

    // Create the team without members first
    const team = new Team(teamData);

    // Make sure teamLeaderId is one of the members if both are provided
    if (
      teamLeaderId &&
      memberIds &&
      !memberIds.includes(teamLeaderId)
    ) {
      memberIds.push(teamLeaderId);
    }

    // If memberIds are provided, add them to the team
    if (memberIds && memberIds.length > 0) {
      // Add members to the team with appropriate roles
      const members = memberIds.map((userId) => ({
        user: userId,
        role: userId === teamLeaderId ? "Leader" : "Member",
        joinedAt: new Date(),
      }));

      team.members = members;
    }

    // Save the team
    const savedTeam = await team.save();

    // Update users to set their teamId
    if (memberIds && memberIds.length > 0) {
      // First update all members as regular team members
      await User.updateMany(
        { _id: { $in: memberIds } },
        { $set: { teamId: savedTeam._id, role: "team_member" } }
      );

      // Then, if a team leader is specified, update their role
      if (teamLeaderId) {
        await User.findByIdAndUpdate(teamLeaderId, {
          role: "team_leader",
        });
      }
    }

    // Populate the team with member details and return
    const populatedTeam = await Team.findById(savedTeam._id).populate(
      "members.user"
    );

    res.status(201).json(populatedTeam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("members.user");
    res.json(updatedTeam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const removeTeamMember = async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    // Find the team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if user is in the team
    const memberIndex = team.members.findIndex(
      (member) => member.user.toString() === userId
    );

    if (memberIndex === -1) {
      return res
        .status(404)
        .json({ message: "User is not a member of this team" });
    }

    // Remove the member from the team
    team.members.splice(memberIndex, 1);
    await team.save();

    // Remove teamId from the user
    await User.findByIdAndUpdate(userId, { $unset: { teamId: "" } });

    res.json({
      message: "Member removed from team successfully",
      team: await Team.findById(teamId).populate("members.user"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Promote a team member to team leader
export const promoteToTeamLeader = async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    // Find the team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if user is in the team
    const memberIndex = team.members.findIndex(
      (member) => member.user.toString() === userId
    );

    if (memberIndex === -1) {
      return res
        .status(404)
        .json({ message: "User is not a member of this team" });
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if there's already a team leader in this team
    const currentLeader = await User.findOne({
      teamId: teamId,
      role: "team_leader",
      isDeleted: false,
    });

    if (currentLeader) {
      // Demote the current team leader to regular member
      currentLeader.role = "team_member";
      await currentLeader.save();

      // Update their role in the team's members array
      const currentLeaderIndex = team.members.findIndex(
        (member) =>
          member.user.toString() === currentLeader._id.toString()
      );

      if (currentLeaderIndex !== -1) {
        team.members[currentLeaderIndex].role = "Member";
      }
    }

    // Update the user's role in both User model and Team model
    user.role = "team_leader";
    await user.save();

    // Update their role in the team
    team.members[memberIndex].role = "Leader";
    await team.save();

    res.json({
      message: "User promoted to team leader successfully",
      team: await Team.findById(teamId).populate("members.user"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const teamId = req.params.id;

    // First, remove teamId from all users who are part of this team
    await User.updateMany(
      { teamId: teamId },
      { $unset: { teamId: "" } }
    );

    // Remove team assignments from tasks
    await Task.updateMany(
      { teamId: teamId },
      { $unset: { teamId: "" } }
    );

    // Remove team assignments from equipment
    await Equipment.updateMany(
      { teamId: teamId },
      { $unset: { teamId: "" } }
    );

    // Then delete the team
    await Team.findByIdAndDelete(teamId);

    res.json({
      message:
        "Team deleted successfully and all assignments cleared",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
