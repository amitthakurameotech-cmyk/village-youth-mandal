import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
    },
    // Card information (masked). DO NOT store full card numbers.
    stripePaymentMethodId: {
      type: String,
    },
    cardBrand: {
      type: String,
    },
    cardFunding: {
      type: String,
      enum: ["credit", "debit", "prepaid", "unknown"],
      default: "unknown",
    },
    cardLast4: {
      type: String,
    },
    cardExpMonth: {
      type: Number,
    },
    cardExpYear: {
      type: Number,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    status: {
      type: String,
      enum: ["created", "succeeded", "failed", "pending", "confirmed"],
      default: "created",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
