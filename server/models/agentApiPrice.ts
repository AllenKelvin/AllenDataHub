import mongoose from "mongoose";

/**
 * Optional per-agent, per-product API price override (in GHS).
 * If not set, we fall back to Product.agentPrice (or Product.price as last resort).
 */
const AgentApiPriceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    price: { type: Number, required: true },
  },
  { timestamps: true },
);

AgentApiPriceSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const AgentApiPrice = mongoose.model("AgentApiPrice", AgentApiPriceSchema);
export default AgentApiPrice;

