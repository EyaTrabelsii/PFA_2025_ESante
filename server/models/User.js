import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
    },
    profilePicture: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin", "team_leader", "team_member"],
      default: "user",
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
    ],
    // Primary team for team leaders
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    // Whether a team leader can manage tasks (controlled by admin)
    canManageTasks: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to get the profile picture URL
userSchema.virtual("profilePictureUrl").get(function () {
  if (this.profilePicture) {
    return `/images/${this.profilePicture}`;
  }
  return this.avatar; // fallback to default avatar
});

// Include virtuals when converting to JSON
userSchema.set("toJSON", { virtuals: true });

// Remove password when converting to JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject({ virtuals: true });
  delete user.password;
  return user;
};

const User = mongoose.model("User", userSchema);

export default User;
