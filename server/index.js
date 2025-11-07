
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register } from "./controller/Usercontoller.js";
import { createEvent, updateEvent, deleteEvent, getEvents } from "./controller/Eventcontroller.js";
import { authMiddleware, isAdmin } from "./middleware/authMiddleware.js";
import { createFeed, deleteFeed, getFeeds } from "./controller/feedcontoller.js";
import { createMedia, deleteMedia, getMedia } from "./controller/mediacontoller.js";
import { uploadProfilePic, uploadEventCover, uploadSingle, uploadMedia } from './middleware/multerMiddleware.js';


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

// =======================
// 🎉 EVENT ROUTES (Protected)
// =======================

// ✅ Only Admin can create event
app.post("/events", isAdmin, uploadEventCover, createEvent);

// ✅ Only Admin can update event
app.put("/events/:id", isAdmin, uploadEventCover, updateEvent);

// ✅ Only Admin can delete event
app.delete("/events/:id", isAdmin, deleteEvent);

// ✅ All authenticated users can view events
app.get("/getevent", getEvents);

// =======================
// 🎉 Feed ROUTES (Protected)
// =======================

app.post("/feeds",  uploadSingle, createFeed);
app.get("/feeds", getFeeds);
app.delete("/deletefeeds/:id",  isAdmin, deleteFeed);
// =======================
// 🎉 Media ROUTES (Protected)
// =======================
app.post("/createMedia",  isAdmin, uploadMedia, createMedia);
app.get("/getMedia", getMedia);
app.delete("/deleteMedia/:id",  isAdmin, deleteMedia);
// =======================
// 🚀 SERVER START
// =======================

app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
