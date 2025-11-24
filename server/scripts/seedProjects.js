import mongoose from "mongoose";
import dotenv from "dotenv";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import User from "../models/User.js";

dotenv.config();

// Project templates for different types of teams
const projectTemplates = {
  development: [
    {
      name: "E-commerce Platform",
      description:
        "Building a modern e-commerce platform with React and Node.js",
      status: "active",
      priority: "high",
      tags: ["react", "nodejs", "mongodb", "e-commerce"],
    },
    {
      name: "Mobile App Development",
      description:
        "Cross-platform mobile application using React Native",
      status: "planning",
      priority: "medium",
      tags: ["react-native", "mobile", "ios", "android"],
    },
    {
      name: "API Microservices",
      description: "Developing scalable microservices architecture",
      status: "active",
      priority: "high",
      tags: ["microservices", "api", "docker", "kubernetes"],
    },
  ],
  design: [
    {
      name: "Brand Identity Redesign",
      description:
        "Complete brand identity and logo redesign project",
      status: "active",
      priority: "high",
      tags: ["branding", "logo", "identity", "design"],
    },
    {
      name: "UI/UX Design System",
      description:
        "Creating comprehensive design system and component library",
      status: "planning",
      priority: "medium",
      tags: ["ui", "ux", "design-system", "components"],
    },
    {
      name: "Website Redesign",
      description:
        "Complete website redesign with modern UI/UX principles",
      status: "planning",
      priority: "medium",
      tags: ["website", "redesign", "ui", "ux"],
    },
  ],
  marketing: [
    {
      name: "Digital Marketing Campaign",
      description:
        "Q4 digital marketing campaign across all channels",
      status: "active",
      priority: "high",
      tags: ["marketing", "digital", "campaign", "social-media"],
    },
    {
      name: "Content Strategy",
      description:
        "Developing comprehensive content strategy for 2024",
      status: "planning",
      priority: "medium",
      tags: ["content", "strategy", "seo", "blog"],
    },
    {
      name: "Social Media Management",
      description:
        "Managing social media presence across all platforms",
      status: "active",
      priority: "medium",
      tags: ["social-media", "content", "engagement"],
    },
  ],
  qa: [
    {
      name: "Automated Testing Suite",
      description:
        "Implementing comprehensive automated testing framework",
      status: "active",
      priority: "high",
      tags: ["testing", "automation", "qa", "selenium"],
    },
    {
      name: "Performance Testing",
      description:
        "Load and performance testing for production systems",
      status: "planning",
      priority: "medium",
      tags: ["performance", "load-testing", "optimization"],
    },
    {
      name: "Quality Assurance Process",
      description:
        "Establishing comprehensive QA processes and standards",
      status: "active",
      priority: "high",
      tags: ["qa", "process", "standards", "quality"],
    },
  ],
  infrastructure: [
    {
      name: "Cloud Migration",
      description:
        "Migrating infrastructure to cloud-based solutions",
      status: "active",
      priority: "high",
      tags: ["cloud", "migration", "aws", "infrastructure"],
    },
    {
      name: "DevOps Pipeline",
      description:
        "Setting up CI/CD pipeline for automated deployments",
      status: "planning",
      priority: "medium",
      tags: ["devops", "ci-cd", "automation", "deployment"],
    },
    {
      name: "Security Audit",
      description:
        "Comprehensive security audit and vulnerability assessment",
      status: "active",
      priority: "urgent",
      tags: ["security", "audit", "vulnerability", "assessment"],
    },
  ],
  data: [
    {
      name: "Data Analytics Platform",
      description:
        "Building comprehensive data analytics and reporting platform",
      status: "active",
      priority: "high",
      tags: ["analytics", "data", "reporting", "dashboard"],
    },
    {
      name: "Machine Learning Pipeline",
      description:
        "Implementing ML pipeline for predictive analytics",
      status: "planning",
      priority: "medium",
      tags: ["machine-learning", "ai", "pipeline", "analytics"],
    },
    {
      name: "Data Warehouse Optimization",
      description:
        "Optimizing data warehouse performance and structure",
      status: "active",
      priority: "medium",
      tags: ["data-warehouse", "optimization", "performance"],
    },
  ],
  default: [
    {
      name: "Team Collaboration Platform",
      description:
        "Internal platform for team collaboration and communication",
      status: "active",
      priority: "medium",
      tags: ["collaboration", "internal", "communication"],
    },
    {
      name: "Process Optimization",
      description: "Optimizing team workflows and processes",
      status: "planning",
      priority: "low",
      tags: ["process", "optimization", "workflow"],
    },
    {
      name: "Knowledge Management System",
      description:
        "Building internal knowledge base and documentation system",
      status: "planning",
      priority: "medium",
      tags: ["knowledge", "documentation", "internal"],
    },
  ],
};

// Get project templates based on team index for better distribution
const getProjectsForTeam = (teamIndex, totalTeams) => {
  const templateTypes = Object.keys(projectTemplates);

  // Distribute teams across different project types
  if (teamIndex % 6 === 0) return projectTemplates.development;
  if (teamIndex % 6 === 1) return projectTemplates.design;
  if (teamIndex % 6 === 2) return projectTemplates.marketing;
  if (teamIndex % 6 === 3) return projectTemplates.qa;
  if (teamIndex % 6 === 4) return projectTemplates.infrastructure;
  if (teamIndex % 6 === 5) return projectTemplates.data;

  return projectTemplates.default;
};

const generateProjectDates = () => {
  const now = new Date();
  const startDate = new Date(
    now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000
  ); // Up to 30 days ago
  const endDate = new Date(
    now.getTime() + (Math.random() * 90 + 30) * 24 * 60 * 60 * 1000
  ); // 30-120 days from now
  const deadline = new Date(
    endDate.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000
  ); // 0-14 days before end

  return { startDate, endDate, deadline };
};

const seedProjects = async () => {
  try {
    console.log("🌱 Starting project seeding...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing projects
    await Project.deleteMany({});
    console.log("🗑️ Cleared existing projects");

    // Get all teams with their members, sorted by name for consistent ordering
    const teams = await Team.find({})
      .populate("members")
      .sort({ name: 1 });
    console.log(`📋 Found ${teams.length} teams`);

    const allProjects = [];

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      console.log(`\n🏗️ Creating projects for team: ${team.name}`);

      const projectTemplatesForTeam = getProjectsForTeam(
        i,
        teams.length
      );
      const teamLeader = team.members.find(
        (member) => member.role === "team_leader"
      );

      // Create 2-3 projects per team
      const numProjects = Math.min(
        projectTemplatesForTeam.length,
        Math.floor(Math.random() * 2) + 2
      );

      for (let j = 0; j < numProjects; j++) {
        const template = projectTemplatesForTeam[j];
        const dates = generateProjectDates();

        const project = new Project({
          name: template.name,
          description: template.description,
          teamId: team._id,
          status: template.status,
          priority: template.priority,
          ...dates,
          projectManager: teamLeader ? teamLeader._id : null,
          progress:
            template.status === "active"
              ? Math.floor(Math.random() * 60) + 20
              : template.status === "completed"
              ? 100
              : Math.floor(Math.random() * 20),
          tags: template.tags,
        });

        const savedProject = await project.save();
        allProjects.push(savedProject);

        console.log(`  ✅ Created project: ${project.name}`);
      }
    }

    console.log(
      `\n🎉 Created ${allProjects.length} projects successfully!`
    );

    // Now update existing tasks to be associated with projects
    console.log(
      "\n🔄 Updating existing tasks with project associations..."
    );

    const tasks = await Task.find({});
    console.log(`📝 Found ${tasks.length} existing tasks`);

    let updatedTasksCount = 0;

    for (const task of tasks) {
      // Find projects for this task's team
      const teamProjects = allProjects.filter(
        (project) =>
          project.teamId.toString() === task.teamId.toString()
      );

      if (teamProjects.length > 0) {
        let eligibleProjects = [];

        // Apply logical constraints based on task status
        switch (task.status) {
          case "completed":
            // Completed tasks should only be in active or completed projects
            eligibleProjects = teamProjects.filter(
              (project) =>
                project.status === "active" ||
                project.status === "completed"
            );
            break;

          case "in_progress":
            // In-progress tasks should only be in active projects
            eligibleProjects = teamProjects.filter(
              (project) => project.status === "active"
            );
            break;

          case "pending":
            // Pending tasks can be in planning or active projects
            eligibleProjects = teamProjects.filter(
              (project) =>
                project.status === "planning" ||
                project.status === "active"
            );
            break;

          default:
            // Fallback to active projects
            eligibleProjects = teamProjects.filter(
              (project) => project.status === "active"
            );
        }

        // If no eligible projects found, fall back to any active project
        if (eligibleProjects.length === 0) {
          eligibleProjects = teamProjects.filter(
            (project) => project.status === "active"
          );
        }

        // If still no projects, fall back to any project (shouldn't happen in normal cases)
        if (eligibleProjects.length === 0) {
          eligibleProjects = teamProjects;
        }

        // Randomly assign task to one of the eligible projects
        const randomProject =
          eligibleProjects[
            Math.floor(Math.random() * eligibleProjects.length)
          ];

        await Task.findByIdAndUpdate(task._id, {
          projectId: randomProject._id,
        });

        updatedTasksCount++;
      }
    }

    console.log(
      `✅ Updated ${updatedTasksCount} tasks with project associations`
    );

    // Recalculate project progress based on assigned tasks
    console.log(
      "\n🔄 Recalculating project progress based on tasks..."
    );

    for (const project of allProjects) {
      const projectTasks = await Task.find({
        projectId: project._id,
      });

      if (projectTasks.length > 0) {
        const completedTasks = projectTasks.filter(
          (task) => task.status === "completed"
        ).length;
        const calculatedProgress = Math.round(
          (completedTasks / projectTasks.length) * 100
        );

        // Update project progress based on actual task completion
        let finalProgress = calculatedProgress;

        // Ensure planning projects have low progress (0-15%)
        if (project.status === "planning") {
          finalProgress = Math.min(calculatedProgress, 15);
        }
        // Ensure completed projects have 100% progress
        else if (project.status === "completed") {
          finalProgress = 100;
        }
        // For active projects, use calculated progress but ensure it's reasonable
        else if (project.status === "active") {
          finalProgress = Math.max(calculatedProgress, 10); // At least 10% for active projects
        }

        await Project.findByIdAndUpdate(project._id, {
          progress: finalProgress,
        });

        console.log(
          `  📊 ${project.name}: ${finalProgress}% (${completedTasks}/${projectTasks.length} tasks completed)`
        );
      } else {
        // No tasks assigned, set appropriate progress based on status
        let defaultProgress = 0;
        if (project.status === "planning") defaultProgress = 0;
        else if (project.status === "active") defaultProgress = 10;
        else if (project.status === "completed")
          defaultProgress = 100;

        await Project.findByIdAndUpdate(project._id, {
          progress: defaultProgress,
        });
      }
    }

    // Display summary
    console.log("\n📊 SEEDING SUMMARY:");
    console.log("==================");

    for (const team of teams) {
      const teamProjects = allProjects.filter(
        (project) => project.teamId.toString() === team._id.toString()
      );

      const teamTasks = await Task.countDocuments({
        teamId: team._id,
      });

      console.log(`\n🏢 ${team.name}:`);
      console.log(`   📁 Projects: ${teamProjects.length}`);
      console.log(`   📝 Tasks: ${teamTasks}`);

      teamProjects.forEach((project) => {
        console.log(`     • ${project.name} (${project.status})`);
      });
    }

    // Project status summary
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

    // Project type distribution
    const projectsByType = {};
    allProjects.forEach((project) => {
      const type = getProjectType(project.tags);
      projectsByType[type] = (projectsByType[type] || 0) + 1;
    });

    console.log("\n🏷️ Project Type Distribution:");
    Object.entries(projectsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log("\n🎉 Project seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding projects:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
};

// Helper function to determine project type from tags
const getProjectType = (tags) => {
  if (
    tags.some((tag) =>
      ["react", "nodejs", "api", "mobile"].includes(tag)
    )
  )
    return "Development";
  if (
    tags.some((tag) =>
      ["design", "ui", "ux", "branding"].includes(tag)
    )
  )
    return "Design";
  if (
    tags.some((tag) =>
      ["marketing", "content", "social-media"].includes(tag)
    )
  )
    return "Marketing";
  if (
    tags.some((tag) => ["testing", "qa", "automation"].includes(tag))
  )
    return "QA";
  if (
    tags.some((tag) =>
      ["cloud", "devops", "security", "infrastructure"].includes(tag)
    )
  )
    return "Infrastructure";
  if (
    tags.some((tag) =>
      ["analytics", "data", "machine-learning"].includes(tag)
    )
  )
    return "Data";
  return "General";
};

// Run the seeding
seedProjects();
