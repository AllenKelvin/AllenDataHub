import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ApiKey } from "./models/apiKey";
import { User } from "./models/user";
import { normalizeUser } from "./auth";

function getPepper() {
  // Pepper is optional but strongly recommended in production.
  return process.env.API_KEY_PEPPER || "";
}

export function hashApiKey(token: string): string {
  return crypto.createHash("sha256").update(token + getPepper()).digest("hex");
}

export function generateApiKey(): { token: string; prefix: string; tokenHash: string } {
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `adh_live_${secret}`;
  const prefix = token.slice(0, 12); // safe-to-display prefix
  const tokenHash = hashApiKey(token);
  return { token, prefix, tokenHash };
}

export async function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const header = (req.header("X-API-Key") || "").trim();
    if (!header) return res.status(401).json({ message: "Missing X-API-Key header" });

    const tokenHash = hashApiKey(header);
    const keyDoc = await ApiKey.findOne({ tokenHash, status: "active" }).lean();
    if (!keyDoc) return res.status(401).json({ message: "Invalid API key" });

    // Ensure the agent still exists and is verified
    const userId = (keyDoc as any).userId?.toString?.() ?? String((keyDoc as any).userId);
    const userDoc = await User.findById(userId).lean();
    if (!userDoc) return res.status(401).json({ message: "API key user not found" });
    const user = normalizeUser({ ...userDoc, id: (userDoc as any)._id?.toString() });
    if (user.role !== "agent") return res.status(403).json({ message: "API access is for agents only" });
    if (!user.isVerified) return res.status(403).json({ message: "Agent not verified" });

    // Mark key used (best-effort, don't block request)
    void ApiKey.updateOne({ _id: (keyDoc as any)._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    (req as any).apiUser = user;
    (req as any).user = user; // reuse existing downstream logic expecting req.user
    return next();
  } catch (e) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

