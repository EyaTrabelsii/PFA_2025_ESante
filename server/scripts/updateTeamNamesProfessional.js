import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../models/Team.js";

// Load environment variables
dotenv.config();

// Professional IT company team names
const professionalITTeamNames = [
  "Frontend Engineering Team",
  "Backend Engineering Team",
  "Full Stack Development Team",
  "Mobile Application Team",
  "DevOps & Infrastructure Team",
  "Data Science & Analytics Team",
  "Machine Learning Team",
  "AI Research Team",
  "Cloud Solutions Team",
  "Platform Engineering Team",
  "Quality Assurance Team",
  "Security & Compliance Team",
  "Product Design Team",
  "User Experience Team",
  "Database Management Team",
  "API Development Team",
  "Microservices Team",
  "Integration Solutions Team",
  "Performance Engineering Team",
  "Release Engineering Team",
  "Site Reliability Team",
  "Network Operations Team",
  "Business Intelligence Team",
  "Automation Testing Team",
  "Cybersecurity Team",
  "Digital Innovation Team",
  "Technical Architecture Team",
  "Software Engineering Team",
  "Solutions Architecture Team",
  "Technology Research Team",
];

const updateTeamNames = async () => {
  try {
    // Use the same connection string as the server
    const MONGODB_URI =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/team-management";

    console.log("Attempting to connect to MongoDB...");
    console.log(
      "Using connection string:",
      MONGODB_URI.replace(/\/\/.*@/, "//***:***@")
    ); // Hide credentials in log

    // Connect to MongoDB with the same options as the server
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully");

    // Get all teams
    const teams = await Team.find({}).sort({ createdAt: 1 });
    console.log(`Found ${teams.length} teams to update`);

    if (teams.length === 0) {
      console.log("No teams found in database");
      return;
    }

    // Update each team with a professional name
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const newName =
        professionalITTeamNames[i % professionalITTeamNames.length];

      console.log(`Updating team: "${team.name}" → "${newName}"`);

      await Team.findByIdAndUpdate(team._id, {
        name: newName,
        description: `Professional IT team specializing in ${newName
          .toLowerCase()
          .replace(" team", "")
          .replace(
            " engineering",
            ""
          )} and related technologies. Dedicated to delivering high-quality software solutions and innovative technology products.`,
        updatedAt: new Date(),
      });
    }

    console.log(
      `\n✅ Successfully updated ${teams.length} teams with professional IT names`
    );

    // Verify the updates
    const updatedTeams = await Team.find({})
      .select("name")
      .sort({ createdAt: 1 });
    console.log("\nUpdated team names:");
    updatedTeams.forEach((team, i) => {
      console.log(`${i + 1}. ${team.name}`);
    });
  } catch (error) {
    console.error("❌ Error updating team names:", error.message);
    if (error.name === "MongooseServerSelectionError") {
      console.error("💡 Possible solutions:");
      console.error("1. Make sure MongoDB is running");
      console.error(
        "2. Check if MONGODB_URI environment variable is set correctly"
      );
      console.error("3. Verify network connectivity to the database");
    }
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
};

updateTeamNames();
