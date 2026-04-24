import mongoose from "mongoose";

/**
 * Stores whether an agent requested API access and whether access is active/revoked.
 * A separate ApiKey document stores the key itself (hashed).
 */
const ApiAccessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "active", "revoked"], default: "pending", index: true },
    requestedAt: { type: Date, default: Date.now },
    activatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const ApiAccess = mongoose.model("ApiAccess", ApiAccessSchema);
export default ApiAccess;

