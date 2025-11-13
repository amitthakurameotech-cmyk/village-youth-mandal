import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        car: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Car",
            required: true,
        },
        pickupLocation: {
            type: String,
            required: true,
        },
        dropLocation: {
            type: String,
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
       
        paymentStatus: {
            type: String,
            enum: ["Pending", "Paid", "Cancelled"],
            default: "Pending",
        },

        bookingStatus: {
            type: String,
            enum: ["Pending", "Confirm", "Cancelled"],
            default: "Pending",
        },
    },
    { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
