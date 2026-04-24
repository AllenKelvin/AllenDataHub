import mongoose from "mongoose";

/**
 * We never store raw API keys. We store a SHA-256 hash of the full token.
 * The plaintext token is shown only once at issuance time.
 */
const ApiKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** e.g. "adh_live_3fK..." (safe to display) */
    prefix: { type: String, required: true, index: true },
    /** sha256(token + pepper) */
    tokenHash: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: null },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ApiKeySchema.index({ userId: 1, status: 1 });

export const ApiKey = mongoose.model("ApiKey", ApiKeySchema);
export default ApiKey;

