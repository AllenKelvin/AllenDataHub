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
}