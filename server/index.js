
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register } from "./controller/Usercontoller.js";
import { createEvent, updateEvent, deleteEvent, getEvents } from "./controller/Eventcontroller.js";
import { authMiddleware, isAdminOrMember } from "./middleware/authMiddleware.js";
import { createFeed, getFeeds } from "./controller/feedcontoller.js";


dotenv.config();
const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.json());
app.use(cors());

// =======================
// 🔐 AUTH ROUTES
// =======================
app.post("/register", register);
app.post("/login", login);

// =======================
// 🎉 EVENT ROUTES (Protected)
// =======================

// ✅ Only Admin can create event
app.post("/events", authMiddleware, isAdminOrMember, createEvent);

// ✅ Only Admin can update event
app.put("/events/:id", authMiddleware, isAdminOrMember, updateEvent);

// ✅ Only Admin can delete event
app.delete("/events/:id", authMiddleware, isAdminOrMember, deleteEvent);

// ✅ All authenticated users can view events
app.get("/getevent", getEvents);


// =======================
// 🎉 Feed ROUTES (Protected)
// =======================

app.post("/feeds", authMiddleware,isAdminOrMember, createFeed);
app.get("/feeds",  getFeeds);
// =======================
// 🚀 SERVER START
// =======================
app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
