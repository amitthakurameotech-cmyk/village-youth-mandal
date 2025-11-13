import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        brand: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["SUV", "Sedan", "Hatchback", "Luxury", "Electric"],
            required: true,
        },
        pricePerDay: {
            type: Number,
            required: true,
        },
        fuelType: {
            type: String,
            enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
            required: true,
        },
        transmission: {
            type: String,
            enum: ["Manual", "Automatic"],
            required: true,
        },
        available: {
            type: Boolean,
            default: true,
        },
        image: {
            type: String, // URL or image path
            default: "",
        },
    },
    { timestamps: true }
);

export default mongoose.model("Car", carSchema);
