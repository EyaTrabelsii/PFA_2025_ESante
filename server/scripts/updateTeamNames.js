import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../models/Team.js";

dotenv.config();

const updateTeamNames = async () => {
  try {
    console.log("🔄 Starting team name update...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all teams sorted by creation date for consistent ordering
    const teams = await Team.find({}).sort({ createdAt: 1 });
    console.log(`📋 Found ${teams.length} teams`);

    console.log("Updating team names...");

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const newName = `Team ${i + 1}`;

      if (team.name !== newName) {
        const oldName = team.name;
        await Team.findByIdAndUpdate(team._id, { name: newName });
        console.log(`✅ Updated "${oldName}" → "${newName}"`);
      } else {
        console.log(`✓ "${team.name}" already has correct name`);
      }
    }

    console.log("\n✨ Team names updated successfully!");
    console.log(`\n    Summary:`);
    console.log(`    - Updated ${teams.length} teams`);
    console.log(
      `    - New naming pattern: Team 1, Team 2, Team 3, etc.`
    );

    // Display final team list
    const updatedTeams = await Team.find({}).sort({ name: 1 });
    console.log("\nUpdated teams:");
    updatedTeams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
    });
  } catch (error) {
    console.error("❌ Error updating team names:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed");
  }
};

// Run the update
updateTeamNames();
