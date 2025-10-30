import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Event title is required"],
            trim: true,
        },

        date: {
            type: Date,
            required: [true, "Event date is required"],
        },

        time: {
            type: String, // You can store it as 'HH:mm' or '5:30 PM'
            required: [true, "Event time is required"],
        },

        location: {
            type: String,
            // required: [true, "Event location is required"],
            trim: true,
        },

        category: {
            type: String,
            enum: ["Festival", "Meeting", "Sports", "Other"],
            default: "Other",
            required: true,
        },

        description: {
            type: String,
            trim: true,
        },

        coverImage: {
            type: String, // Cloudinary URL or local file path
            default: "",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        attendees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
