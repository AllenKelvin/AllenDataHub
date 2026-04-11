import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
    paymentStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    price: { type: Number, required: true },
    dataAmount: { type: String, required: true },
    phoneNumber: { type: String, required: false },
    productName: { type: String, required: false },
    vendorOrderId: { type: String },
    /** Client reference sent to Portal-02; vendor webhooks may echo this for lookup */
    clientOrderReference: { type: String, index: true },
    /** Last time vendor webhook reported a status change for this order */
    lastStatusUpdateAt: { type: Date },
    orderSource: { type: String, enum: ["web", "api"], default: "web" },
    walletBalanceBefore: { type: Number },
    walletBalanceAfter: { type: Number },
    processingResults: [{ itemIndex: Number, success: Boolean, transactionId: String, reference: String, message: String, error: String, status: String }],
    webhookHistory: [{ event: String, orderId: String, reference: String, status: String, recipient: String, volume: Number, timestamp: Date }],
  },
  { timestamps: true },
);

// Helpful compound index for common queries (filter by user and status)
OrderSchema.index({ userId: 1, status: 1 });

export const Order = mongoose.model("Order", OrderSchema);
export default Order;
