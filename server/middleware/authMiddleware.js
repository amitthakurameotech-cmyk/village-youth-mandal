import jwt from "jsonwebtoken";
import User from "../model/Usermodel.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }

    req.user = user; // attach logged-in user info to req
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Unauthorized", error: error.message });
  }
};

// export const isAdmin = (req, res, next) => {
//   if (req.user.role !== "admin") {
//     return res.status(403).json({ success: false, message: "Access denied: Admins only" });
//   }
//   next();
// };
// export const isMember = (req, res, next) => {
//   if (req.user.role !== "member") {
//     return res.status(403).json({ success: false, message: "Access denied: member only" });
//   }
//   next();
// };

export const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Admins only"
    });
  }
  next();
};

// export const isAdminOrMember = (req, res, next) => {
//   if (req.user.role === "admin" || req.user.role === "member") {
//     return next();
//   }
//   return res.status(403).json({
//     success: false,
//     message: "Access denied: Only Admins or Members can perform this action"
//   });
// };

//--------------------
//data to test createEvent API
//--------------------
// {
//   "title": "Holi Celebration",
//   "date": "2025-11-05",
//   "time": "07:00 PM",
//   "location": "Village Community Hall",
//   "category": "Festival",
//   "description": "Holi day celebration with fireworks and sweets distribution.",
//   "createdBy": "6900c726e061e68191ce70fb"
// }

// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDBjNzI2ZTA2MWU2ODE5MWNlNzBmYiIsImlhdCI6MTc2MTcyMDY2OSwiZXhwIjoxNzY0MzEyNjY5fQ.lUIBaFLuDYQyFSACq0N5SR87cJHfW5eP1Qv-wWj8VpQ