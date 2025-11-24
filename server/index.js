
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register, requestPasswordReset, resetPassword } from "./controller/Usercontoller.js";

import { uploadcarpic, uploadProfilePic } from './middleware/multerMiddleware.js';
import { createCar, deleteCar,  getCarDataById,  getCars, updateCar } from "./controller/Carcontoller.js";
import {  approveCancelRequest, createBooking, deleteBooking, getBookingDataByUserId, getBookings, updateBooking } from "./controller/BookingController.js";
import { authMiddleware, isAdmin } from "./middleware/authMiddleware.js";
import { createCheckoutSession, handleWebhook, getPaymentHistory, getPaymentSession } from "./controller/PaymentController.js";


dotenv.config();
const PORT = process.env.PORT || 8000;
const app = express();

// Ensure Stripe keys are configured
const _stripeSecret = process.env.STRIPE_SECRET_KEY ;
const _webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!_stripeSecret) {
  console.error("❌ STRIPE secret key not set. Please set STRIPE_SECRET_KEY (or SECRET_KEY/secret_key) in your .env.");
  process.exit(1);
}
if (!_webhookSecret) {
  console.error("❌ STRIPE webhook secret not set. Please set STRIPE_WEBHOOK_SECRET in your .env.");
  process.exit(1);
}

// Mount webhook route first so its raw body middleware runs before express.json()
app.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve uploaded files


// =======================
// 🔐 AUTH ROUTES
// =======================
app.post("/register", uploadProfilePic, register);
app.post("/login", login);
app.post("/forgetpassword", requestPasswordReset);
app.patch("/reset-password/:token", resetPassword);


// =======================
// 🔐 Car ROUTES
// =======================

app.post("/cars", authMiddleware,isAdmin, uploadcarpic, createCar);
app.get("/cars", getCars);
app.get("/cars/:id", getCarDataById);
app.put("/cars/:id", authMiddleware,isAdmin, updateCar);
app.delete("/cars/:id",authMiddleware,isAdmin, deleteCar);
// =======================
// 🔐 Booking ROUTES
// =======================
app.post("/bookings",authMiddleware, createBooking);
app.get("/bookings", getBookings);
 app.get("/bookings/:userId", getBookingDataByUserId);
app.put("/bookings/:id", updateBooking);
app.delete("/bookings/:id", deleteBooking);
app.patch("/approve/:id",approveCancelRequest );
// app.delete("/cancel/:id",cancelBooking );

// =======================
// 🔐 Payment ROUTES (Stripe Checkout)
// =======================
app.post("/payments/checkout/:bookingId", authMiddleware, createCheckoutSession);
app.post("/payments/create-intent/:bookingId", authMiddleware, createCheckoutSession); // Alias for backward compatibility
app.get("/payments/user/:userId", authMiddleware, getPaymentHistory);
app.get("/payments/session/:sessionId", getPaymentSession);



// =======================
// 🚀 SERVER START
// =======================

app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
