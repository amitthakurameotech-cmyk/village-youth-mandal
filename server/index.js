// import dotenv from "dotenv";
// import cors from "cors";
// import express from "express";
// import { connectDB } from "./config/db.js";
// import { login, register } from "./controller/Usercontoller.js";
// import { createEvent, updateEvent, deleteEvent, getEvents } from './controller/Eventcontroller.js';


// const PORT = process.env.PORT || 8080;
// const app = express();
// dotenv.config();
// app.use(express.json());
// app.use(cors());

// //Auth Routes
// app.post("/register",register);
// app.post("/login",login);

// //Event Routes

// app.post('/events', createEvent);
// app.put('/events/:id', updateEvent);
// app.delete('/events/:id', deleteEvent);
// app.get("/getevent",getEvents);
// app.listen(PORT, () => {
//     connectDB();
//     console.log("server is running on PORT:" + PORT);

// });
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { login, register } from "./controller/Usercontoller.js";
import { createEvent, updateEvent, deleteEvent, getEvents } from "./controller/Eventcontroller.js";
import { authMiddleware, isAdmin } from "./middleware/authMiddleware.js";

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
app.post("/events", authMiddleware, isAdmin, createEvent);

// ✅ Only Admin can update event
app.put("/events/:id", authMiddleware, isAdmin, updateEvent);

// ✅ Only Admin can delete event
app.delete("/events/:id", authMiddleware, isAdmin, deleteEvent);

// ✅ All authenticated users can view events
app.get("/getevent", authMiddleware, getEvents);

// =======================
// 🚀 SERVER START
// =======================
app.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server is running on PORT: ${PORT}`);
});
