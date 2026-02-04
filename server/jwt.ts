import jwt from "jsonwebtoken";
import { type Request, type Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "allendatahub-super-secret-jwt-key-2024-for-ghana";
const ACCESS_TOKEN_EXPIRY = "15m"; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = "7d"; // Long-lived refresh token

export interface JWTPayload {
  id: string;
  username: string;
  role: string;
}

/**
 * Generate access token (short-lived, in memory)
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generate refresh token (long-lived, stored in httpOnly cookie)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Middleware to verify JWT token from Authorization header
 */
export function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Attach user to request
  (req as any).user = payload;
  next();
}

/**
 * Set refresh token in httpOnly secure cookie
 */
export function setRefreshCookie(res: Response, token: string) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: "none", // Allow cross-domain
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshCookie(res: Response) {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
}
