
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register, requestPasswordReset, resetPassword } from "./controller/Usercontoller.js";

import { uploadcarpic, uploadProfilePic } from './middleware/multerMiddleware.js';
import { createCar, deleteCar,  getCarDataById,  getCars, updateCar } from "./controller/Carcontoller.js";
import {  approveCancelRequest, createBooking, deleteBooking, getBookingDataByUserId, getBookings, updateBooking } from "./controller/BookingController.js";
import { authMiddleware, isAdmin } from "./middleware/authMiddleware.js";


dotenv.config();
const PORT = process.env.PORT || 8000;
const app = express();

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
// 🚀 SERVER START
// =======================

app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
