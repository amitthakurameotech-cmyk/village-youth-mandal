
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register, requestPasswordReset, resetPassword } from "./controller/Usercontoller.js";

import { uploadcarpic, uploadProfilePic } from './middleware/multerMiddleware.js';
import { createCar, deleteCar,  getCarDataById,  getCars, updateCar } from "./controller/Carcontoller.js";
import {  approveCancelRequest, createBooking, deleteBooking, getBookingDataByUserId, getBookings, updateBooking } from "./controller/BookingController.js";
import { authMiddleware, isAdmin } from "./middleware/authMiddleware.js";
import { createCheckoutSession, getPaymentHistory, getPaymentSession, saveFrontendSession, handleWebhook } from "./controller/PaymentController.js";


dotenv.config();
const PORT = process.env.PORT || 8000;
const app = express();

// Read Stripe keys
const _stripeSecret = process.env.STRIPE_SECRET_KEY;
const _webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!_stripeSecret) {
  console.warn("⚠️ STRIPE_SECRET_KEY not set. Checkout session creation will fail.");
}

if (!_webhookSecret) {
  console.warn("⚠️ STRIPE_WEBHOOK_SECRET not set. Webhooks will fail signature verification.");
}

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
// Webhook must be mounted BEFORE express.json() to preserve raw body
app.post("/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);
// Other payment endpoints
// app.post("/payments/checkout/:bookingId", authMiddleware, createCheckoutSession);
app.post("/payments/create-intent/:bookingId", authMiddleware, createCheckoutSession);
app.get("/payments/user/:userId", authMiddleware, getPaymentHistory);
app.get("/payments/session/:sessionId", getPaymentSession);
app.post("/payments/save-frontend", saveFrontendSession);


// =======================
// 🚀 SERVER START
// =======================

app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
