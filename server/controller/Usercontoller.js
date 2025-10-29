import bcrypt from "bcryptjs";
import User from "../model/Usermodel.js";
import { generateToken } from "../config/Auth.js";
//import twilio from "twilio";
export const register = async (req, res) => {
  try {
    //const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

    const { email, password, fullName } = req.body;

    // Check email
    const checkemail = await User.findOne({ email });
    if (checkemail) {
      return res.status(401).send({ message: "Email already exists, try with another email" });
    }

    // Check phone number
    // const checkphoneNumber = await User.findOne({ phoneNumber });
    // if (checkphoneNumber) {
    //   return res.status(401).send({ message: "Phone number already exists, try with another number" });
    // }

    // Hash password
    const hashpassword = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user
    const data = await User.create({
      ...req.body,
      fullName,
      email,

      password: hashpassword,

    });

    // Send OTP via Twilio
    // await client.messages.create({
    //   body: `Your verification code is ${otp}`,
    //   from: process.env.TWILIO_PHONE,
    //   to: phoneNumber,
    // });

    if (data) res.status(201).send({
      message: "User successfully created",
      userId: data._id,

    });
    else
      res.status(404).send({
        message: " unable to create a User",

      });


  } catch (error) {
    console.error("fail to submit data:", error);
    return res.status(500).send({ message: "Internal server error", error: error.message });
  }
};

// export const login = async (req, res) => {
//   try {

//     const { email, password } = req.body;
//     const user = await User.findOne({ email });
//       console.log(user);
//     if (!user) {
//       return res.status(401).send({ message: "Invalid email or password" });
//     }
//     // if (!user.isVerified) {
//     //     return res.status(401).send({ message: "Please verify your phoneNumebr before logging in." });
//     // }
//     const Ismatch = await bcrypt.compare(password, user.password);
//     if (!Ismatch) {
//       res.status(401).send({ message: " Invalid Or Wrong Password" })
//     }

//     // ✅ Pass user._id to generateToken
//     const token = generateToken(user._id);
//     //console.log(token);
//     res.status(200).send({

//       message: "User Login Successfully",
//       email: user.email,
//       fullName: user.fullName,
//       id: user._id,
//       token,

//     });

//     // else
//     //     res.status(401).send({ message: "User Login Successfully" })
//   } catch (error) {
//     console.log("fail to submit data");
//   }
// }
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // ✅ Include password (since it's select: false in schema)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Optional: update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Send response
    return res.status(200).json({
      message: "User login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token,
    });

  } catch (error) {
    console.error("❌ Login Error:", error);
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
};