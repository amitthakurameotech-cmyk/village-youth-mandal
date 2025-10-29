import mongoose from "mongoose";

// User Schema

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: 2,
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            match: [/\S+@\S+\.\S+/, "Invalid email address"],
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
            select: false, // Exclude from query results by default
        },

        phone: {
            type: String,
            trim: true,
            match: [/^[0-9]{10}$/, "Invalid phone number"],
        },

        address: {
            type: String,
            trim: true,
        },

        profilePic: {
            type: String, // Cloudinary or local URL
            default: "",
        },

        role: {
            type: String,
            enum: ["admin", "member", "user"], // 3 roles
            default: "user"
        },

        monthlyFund: {
            type: Number,
            default: 0, // total fund contributed
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        lastLogin: {
            type: Date,
        },

        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true, // automatically adds createdAt & updatedAt
    }
);


const User = mongoose.model("User", userSchema);
export default User;
