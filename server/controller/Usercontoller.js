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


// POST /forgetpassword
// Body: { email }
// Generates a password reset token, stores hashed token + expiry on user, and sends email with reset link
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("📬 Password reset request for email:", email);
    
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Find the user
    const user = await User.findOne({ email });
    console.log("🔍 User found:", user ? `✅ ${user.email}` : "❌ No user found");
    
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
    console.log("✅ Reset token saved for user:", user.email);

    // Build frontend reset URL
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
    console.log("🔗 Reset URL built:", resetUrl);

    // Setup transporter
    let transporter;
    let isTestAccount = false;

    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    console.log("🔧 SMTP Configured:", smtpConfigured ? "✅ Yes" : "❌ No (will use Ethereal if dev)");

    if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
      console.log("📧 Creating Ethereal test account...");
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        isTestAccount = true;
        console.log('✅ Ethereal test account created');
        console.log('📧 Test Email User:', testAccount.user);
      } catch (acctErr) {
        console.error('❌ Failed to create Ethereal test account:', acctErr.message);
        return res.status(500).json({ message: 'Unable to prepare email provider for sending reset link' });
      }
    } else if (smtpConfigured) {
      console.log("📬 Using configured SMTP...");
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.error('❌ No SMTP configured and not in development mode');
      return res.status(500).json({ message: 'Email service not configured' });
    }

    // Verify transporter connection
    console.log("🔐 Verifying transporter...");
    try {
      await transporter.verify();
      console.log('✅ Transporter verified successfully');
    } catch (verifyErr) {
      console.error('❌ SMTP transporter verify failed:', verifyErr.message);
      return res.status(500).json({ message: 'Email service verification failed', error: verifyErr.message });
    }

    // Professional HTML email
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@carental.com',
      to: user.email,
      subject: '🔐 Car Rental - Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .header { text-align: center; color: #333; margin-bottom: 30px; border-bottom: 3px solid #007bff; padding-bottom: 20px; }
              .header h2 { margin: 0; font-size: 24px; color: #007bff; }
              .content { color: #555; line-height: 1.6; font-size: 14px; }
              .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 25px 0; font-weight: bold; cursor: pointer; }
              .button:hover { background-color: #0056b3; }
              .link-section { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #007bff; }
              .link-section p { margin: 10px 0; }
              .reset-link { word-break: break-all; color: #007bff; font-family: 'Courier New', monospace; font-size: 12px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
              .footer { text-align: center; color: #999; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
              .warning { color: #d9534f; font-weight: bold; }
              .note { color: #666; font-size: 13px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🔐 Password Reset Request</h2>
              </div>
              
              <div class="content">
                <p>Hello <strong>${user.fullName || 'User'}</strong>,</p>
                
                <p>We received a request to reset your password for your Car Rental account. If you made this request, click the button below to proceed:</p>
                
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Your Password</a>
                </div>
                
                <div class="link-section">
                  <p><strong>Or copy and paste this link in your browser:</strong></p>
                  <p class="reset-link">${resetUrl}</p>
                </div>
                
                <p><span class="warning">⏰ Security Notice: This link expires in 1 hour.</span> After that, you will need to request a new reset link.</p>
                
                <p class="note"><strong>⚠️ Important:</strong> If you did not request a password reset, please ignore this email or contact our support team immediately. Your account may be at risk.</p>
                
                <p style="margin-top: 30px;">Best regards,<br><strong>Car Rental Team</strong></p>
              </div>
              
              <div class="footer">
                <p>© 2025 Car Rental System. All rights reserved.</p>
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>If you need assistance, visit our <a href="https://carental.com/support" style="color: #007bff; text-decoration: none;">support page</a></p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    console.log("📧 Sending email to:", user.email);
    console.log("📧 From:", mailOptions.from);
    
    // Send email
    try {
      const sendInfo = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully');
      console.log('📧 Message ID:', sendInfo.messageId);
      
      if (isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(sendInfo);
        console.log('🔗 Ethereal Preview URL:', previewUrl);
        return res.status(200).json({ 
          message: 'Password reset link has been sent to your email',
          previewUrl,
          devInfo: {
            resetToken,
            resetUrl,
            expiresIn: '1 hour'
          }
        });
      }
      
      return res.status(200).json({ message: 'Password reset link has been sent to your email. Check your inbox.' });
    } catch (mailErr) {
      console.error('❌ Error sending reset email:', mailErr.message);
      console.error('❌ Full error:', mailErr);
      return res.status(500).json({ message: 'Failed to send reset email', error: mailErr.message });
    }
  } catch (error) {
    console.error('❌ Error in requestPasswordReset:', error);
    return res.status(500).json({ message: 'Server error generating reset token', error: error.message });
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
