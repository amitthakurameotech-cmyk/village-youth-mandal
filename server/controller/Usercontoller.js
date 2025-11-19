import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
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

   

    // Hash password
    const hashpassword = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Handle profilePic upload
    let profilePicPath = "";
    if (req.file && req.file.path) {
      profilePicPath = req.file.path;
    }

    // Create user
    const data = await User.create({
      ...req.body,
      fullName,
      email,
      phone: req.body.phone,
      password: hashpassword,
      profilePic: profilePicPath,
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


// POST /users/forgot
// Body: { email }
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Find the user. Always respond with a generic success message to avoid account enumeration.
    const user = await User.findOne({ email });
    console.log(user);
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    // Generate a token (raw) and a hashed version to store
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (1 hour)
    user.resetPasswordToken = hash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Build frontend reset URL (frontend should have a page to accept the token)
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

    // Create transporter using SMTP environment variables
    // Create transporter using SMTP environment variables. If SMTP is not configured and we're in
    // development, fall back to Ethereal (nodemailer test account) so you can preview emails.
    let transporter;
    let isTestAccount = false;
    let sendInfo;

    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
      // Create ethereal test account
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        isTestAccount = true;
        console.log('ℹ️ Using Ethereal test account for email (development)');
      } catch (acctErr) {
        console.error('❌ Failed to create Ethereal test account:', acctErr);
        return res.status(500).json({ message: 'Unable to prepare email provider for sending reset link' });
      }
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // Verify transporter connection (helpful to catch config errors quickly)
    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error('❌ SMTP transporter verify failed:', verifyErr);
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ message: 'SMTP verification failed', error: verifyErr.message });
      }
      // In production, still return generic success to the client
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    };

    // Send email. In development with Ethereal, return preview URL to help debugging.
    try {
      sendInfo = await transporter.sendMail(mailOptions);
      if (isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(sendInfo);
        console.log('ℹ️ Preview URL:', previewUrl);
        return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.', previewUrl });
      }
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (mailErr) {
      console.error('❌ Error sending reset email:', mailErr);
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ message: 'Failed to send reset email', error: mailErr.message });
      }
      // In production, don't leak SMTP errors to the client
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }
  } catch (error) {
    console.error('❌ Error generating reset token:', error);
    return res.status(500).json({ message: 'Server error generating reset token' });
  }
};

// PATCH /users/reset/:token
// Body: { password }
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) return res.status(400).json({ message: 'Reset token is required' });
    if (!password || typeof password !== 'string' || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hash, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    // Hash new password and save
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    return res.status(500).json({ message: 'Server error resetting password' });
  }
};
