import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import equipmentRoutes from "./routes/equipmentRoutes.js";
import authRoutes from "./routes/auth.js";
import statsRoutes from "./routes/statsRoutes.js";
import projectRoutes from "./routes/projects.js";

dotenv.config();

const app = express();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables
const isProduction = process.env.NODE_ENV === "production";

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from images directory
app.use("/images", express.static(path.join(__dirname, "images")));

// Morgan logger setup - 'dev' for development, 'combined' for production
app.use(
  morgan(isProduction ? "combined" : "dev", {
    skip: (req, res) => res.statusCode < 400 && isProduction, // Skip logging successful requests in production
  })
);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/projects", projectRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`,
    status: 404,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  console.error(`${new Date().toISOString()} - Error:`, {
    method: req.method,
    path: req.path,
    statusCode: err.status || 500,
    message: err.message,
    stack: isProduction ? null : err.stack,
  });

  // Send response to client
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    status: err.status || 500,
    error: isProduction
      ? {}
      : {
          stack: err.stack,
          ...err,
        },
  });
});

// MongoDB connection with retry logic
const connectWithRetry = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("MongoDB connected successfully");
      return;
    } catch (error) {
      retries++;
      console.error(
        `MongoDB connection attempt ${retries} failed:`,
        error.message
      );
      if (retries === maxRetries) {
        console.error(
          "Max retries reached. Could not connect to MongoDB."
        );
        process.exit(1);
      }
      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

// Start server only after MongoDB connection
const startServer = async () => {
  try {
    await connectWithRetry();
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(
        `Environment: ${process.env.NODE_ENV || "development"}`
      );
      console.log(
        `Morgan logging: ${
          isProduction
            ? "production mode (combined)"
            : "development mode (dev)"
        }`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
