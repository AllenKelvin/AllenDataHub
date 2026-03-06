import { type Express } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  setRefreshCookie,
  clearRefreshCookie,
  type JWTPayload,
} from "./jwt";

const scryptAsync = promisify(scrypt);

// Reset tokens storage (in production, use a database)
const resetTokens: Map<string, { token: string; expiry: number; email: string }> = new Map();

// EXPORT hashPassword
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// EXPORT comparePassword
export async function comparePassword(supplied: string, stored: string) {
  if (!stored) return false;

  if (stored.includes('.')) {
    try {
      const [hashed, salt] = stored.split(".");
      const hashedPasswordBuf = Buffer.from(hashed, "hex");
      const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
    } catch (e) {
      return false;
    }
  }

  if (/^\$2[aby]\$/.test(stored)) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (e) {
      return false;
    }
  }

  return supplied === stored;
}

// EXPORT normalizeUser
export function normalizeUser(user: any) {
  if (!user) return user;
  let role = user.role;
  if (role === 'client') role = 'user';
  return {
    ...user,
    role,
    balance: typeof user.balance === 'string' ? parseFloat(user.balance) : user.balance,
    totalOrdersToday: typeof user.totalOrdersToday === 'string' ? parseInt(user.totalOrdersToday) : user.totalOrdersToday,
    totalGBSentToday: typeof user.totalGBSentToday === 'string' ? parseFloat(user.totalGBSentToday) : user.totalGBSentToday,
    totalSpentToday: typeof user.totalSpentToday === 'string' ? parseFloat(user.totalSpentToday) : user.totalSpentToday,
    totalGBPurchased: typeof user.totalGBPurchased === 'string' ? parseFloat(user.totalGBPurchased) : (user.totalGBPurchased ?? 0),
  };
}

export function setupAuth(app: Express) {
  // Trust the proxy (needed for secure cookies)
  app.set("trust proxy", 1);

  // Login endpoint - return access token + refresh token in httpOnly cookie
  app.post("/api/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ message: "Missing identifier or password" });
      }

      const user = await storage.getUserByUsername(identifier);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });

      const matched = await comparePassword(password, user.password);
      if (!matched) return res.status(401).json({ message: "Invalid username or password" });

      // Auto-migrate legacy passwords
      if (typeof user.password === 'string' && !user.password.includes('.')) {
        const newHash = await hashPassword(password);
        const uid = (user as any).id || (user as any)._id?.toString();
        if (uid) await storage.updatePassword(uid, newHash);
      }

      // Generate tokens
      const uid = (user as any).id || (user as any)._id?.toString();
      const userRole = user.role === 'user' ? 'user' : user.role;
      const payload: JWTPayload = {
        id: uid,
        username: user.username,
        role: userRole,
        email: user.email,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Set refresh token in httpOnly cookie
      setRefreshCookie(res, refreshToken);

      // Return user data + access token
      return res.json({
        user: normalizeUser(user),
        accessToken,
      });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const userData = req.body;

      // Validate email is provided and in correct format
      if (!userData.email || !userData.email.includes('@') || !userData.email.includes('.')) {
        return res.status(400).json({ message: "Valid email address is required" });
      }

      // Validate password is provided
      if (!userData.password || userData.password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Validate username is provided
      if (!userData.username || userData.username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }

      // Check for existing user
      const existing = await storage.getUserByUsername(userData.username || userData.email);
      if (existing) {
        return res.status(400).json({ message: "Username or email already exists" });
      }

      // Admin registration disabled
      if (userData.role === 'admin') {
        return res.status(403).json({ message: "Admin registration is disabled" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword,
        isVerified: userData.role === 'user',
      });

      // Generate tokens
      const uid = (newUser as any).id || (newUser as any)._id?.toString();
      const newUserRole = newUser.role === 'user' ? 'user' : newUser.role;
      const payload: JWTPayload = {
        id: uid,
        username: newUser.username,
        role: newUserRole,
        email: newUser.email,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Set refresh token in httpOnly cookie
      setRefreshCookie(res, refreshToken);

      // Return user data + access token
      return res.status(201).json({
        user: normalizeUser(newUser),
        accessToken,
      });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Logout endpoint - clear refresh token
  app.post("/api/logout", (req, res) => {
    clearRefreshCookie(res);
    res.json({ message: "Logged out" });
  });

  // Get current user endpoint (optional auth - returns null if not logged in)
  app.get("/api/user", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json(null); // Not authenticated
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (!payload) return res.json(null); // Invalid token

    // Fetch fresh user data from database
    (async () => {
      try {
        const user = await storage.getUser(payload.id);
        if (!user) return res.json(null);
        const normalized = normalizeUser(user);
        res.json(Array.isArray(normalized) ? normalized[0] : normalized);
      } catch (e) {
        res.status(500).json({ message: "Internal Server Error" });
      }
    })();
  });

  // Refresh token endpoint - issue new access token
  app.post("/api/refresh", (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) return res.status(401).json({ message: "Missing refresh token" });

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) return res.status(401).json({ message: "Invalid refresh token" });

    // Issue new access token
    const accessToken = generateAccessToken(payload);
    res.json({ accessToken });
  });

  // Forgot Password endpoint - send reset link via email
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email address is required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        // For security, don't reveal if email exists
        return res.json({ message: "If an account with this email exists, a reset link has been sent." });
      }

      // Generate unique reset token
      const resetToken = randomBytes(32).toString('hex');
      const tokenExpiry = Date.now() + 3600000; // 1 hour expiry
      const userId = (user as any).id || (user as any)._id?.toString();
      const username = user.username || "User";

      // Store reset token
      resetTokens.set(userId, { token: resetToken, expiry: tokenExpiry, email });

      // Send email via Brevo API
      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.BREVO_API_KEY || "",
          },
          body: JSON.stringify({
            sender: { name: "AllenDataHub", email: "noreply@allendatahub.com" },
            to: [{ email, name: username }],
            subject: "Password Reset Request - AllenDataHub",
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0;">AllenDataHub</h1>
                </div>
                <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi ${username},</p>
                  
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">We received a request to reset your password. Here is your reset token:</p>
                  
                  <div style="background-color: #fff; border: 2px dashed #3b82f6; padding: 20px; text-align: center; margin: 30px 0; border-radius: 6px;">
                    <p style="font-size: 12px; color: #6b7280; margin: 0 0 10px 0;">Reset Token (Valid for 1 hour)</p>
                    <p style="font-size: 18px; font-weight: bold; color: #3b82f6; margin: 0; word-break: break-all; font-family: monospace;">${resetToken}</p>
                  </div>
                  
                  <p style="font-size: 14px; color: #1f2937; margin: 0 0 20px 0;">Go to the password reset page and paste this token along with your new password to complete the reset process.</p>
                  
                  <p style="font-size: 14px; color: #666; margin: 0 0 20px 0;">This token will expire in 1 hour for security reasons.</p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                  
                  <p style="font-size: 12px; color: #6b7280; margin: 0;">If you didn't request a password reset, please ignore this email. Your account remains secure.</p>
                </div>
              </div>
            `,
          }),
        });

        if (!brevoResponse.ok) {
          const error = await brevoResponse.json();
          console.error("Brevo email error:", error);
          // Don't fail the request, just log the error
        } else {
          console.log(`[Password Reset] Email sent to ${email}`);
        }
      } catch (emailError) {
        console.error("Failed to send email via Brevo:", emailError);
        // Continue anyway - token is still stored
      }

      res.json({ message: "If an account with this email exists, a reset link has been sent." });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Reset Password endpoint - validate token and update password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;

      if (!email || !token || !newPassword) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or token" });
      }

      const userId = (user as any).id || (user as any)._id?.toString();
      const storedReset = resetTokens.get(userId);

      if (!storedReset || storedReset.token !== token) {
        return res.status(401).json({ message: "Invalid token" });
      }

      if (storedReset.expiry < Date.now()) {
        resetTokens.delete(userId);
        return res.status(401).json({ message: "Token has expired" });
      }

      // Hash new password and update user
      const hashedPassword = await hashPassword(newPassword);
      const updated = await storage.updatePassword(userId, hashedPassword);

      if (!updated) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      // Clear reset token
      resetTokens.delete(userId);

      res.json({ message: "Password reset successfully" });
    } catch (e) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
}