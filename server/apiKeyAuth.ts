import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { AgentApiConfig } from "./models/agentApiConfig";
import { User } from "./models/user";

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateApiKeyPlaintext(): string {
  return `adh_${crypto.randomBytes(24).toString("hex")}`;
}

export type ApiAgentContext = {
  id: string;
  user: any;
  config: any;
};

export async function verifyApiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-api-key"];
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) {
    return res.status(401).json({ message: "Missing X-API-Key header" });
  }
  const keyHash = hashApiKey(key);
  const config = await AgentApiConfig.findOne({ keyHash, status: "active" }).lean();
  if (!config) {
    return res.status(401).json({ message: "Invalid API key" });
  }
  const user = await User.findById(config.userId).lean();
  if (!user || user.role !== "agent" || !user.isVerified) {
    return res.status(403).json({ message: "API access denied" });
  }
  await AgentApiConfig.updateOne({ _id: config._id }, { $set: { lastUsedAt: new Date() } });
  (req as any).apiAgent = {
    id: (user as any)._id.toString(),
    user,
    config,
  } as ApiAgentContext;
  next();
}

export function productPricesToRecord(productPrices: unknown): Record<string, number> {
  if (!productPrices) return {};
  if (productPrices instanceof Map) {
    const out: Record<string, number> = {};
    productPrices.forEach((v, k) => {
      if (typeof v === "number") out[String(k)] = v;
    });
    return out;
  }
  if (typeof productPrices === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(productPrices as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) out[k] = v;
    }
    return out;
  }
  return {};
}

export function resolveApiPrice(productId: string, product: { agentPrice?: number | null; price?: number | null }, priceMap: Record<string, number>): number {
  const custom = priceMap[productId];
  if (typeof custom === "number" && custom > 0) return custom;
  const agent = product.agentPrice ?? product.price;
  return typeof agent === "number" ? agent : 0;
}
