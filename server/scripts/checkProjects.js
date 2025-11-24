import mongoose from "mongoose";
import dotenv from "dotenv";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";

dotenv.config();

const checkProjects = async () => {
  try {
    console.log("🔍 Checking projects in database...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Count projects
    const projectCount = await Project.countDocuments();
    console.log(`📁 Total projects in database: ${projectCount}`);

    if (projectCount === 0) {
      console.log("❌ No projects found in database!");
      return;
    }

    // Get sample projects
    const projects = await Project.find().limit(10);
    console.log("\n📋 Sample projects:");
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const team = await Team.findById(project.teamId);
      console.log(`${i + 1}. ${project.name}`);
      console.log(`   Team: ${team?.name || 'Unknown'}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Priority: ${project.priority}`);
      console.log(`   Progress: ${project.progress}%`);
      console.log("");
    }

    // Check tasks with projects
    const tasksWithProjects = await Task.countDocuments({ projectId: { $exists: true } });
    const totalTasks = await Task.countDocuments();
    console.log(`📝 Tasks with projects: ${tasksWithProjects}/${totalTasks}`);

    // Project status distribution
    const statusCounts = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("\n📈 Project Status Distribution:");
    statusCounts.forEach((status) => {
      console.log(`   ${status._id}: ${status.count}`);
    });

  } catch (error) {
    console.error("❌ Error checking projects:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
};

// Run the check
checkProjects();
 