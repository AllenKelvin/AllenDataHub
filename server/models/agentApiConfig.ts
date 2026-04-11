import mongoose from "mongoose";

const AgentApiConfigSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "active", "revoked"], default: "pending", index: true },
    keyHash: { type: String, default: null, index: true },
    productPrices: { type: Map, of: Number, default: {} },
    requestedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export const AgentApiConfig = mongoose.model("AgentApiConfig", AgentApiConfigSchema);
export default AgentApiConfig;
