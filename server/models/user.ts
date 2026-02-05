import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: false, default: null },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "agent", "user"], default: "user" },
    isVerified: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    // Tracking metrics
    totalOrdersToday: { type: Number, default: 0 },
    totalGBSentToday: { type: Number, default: 0 },
    totalSpentToday: { type: Number, default: 0 },
    totalGBPurchased: { type: Number, default: 0 },
    // Cart items stored per user to persist selection between sessions (private per account)
    cart: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1 },
        phoneNumber: { type: String, required: false },
      },
    ],
  },
  { timestamps: true },
);

export const User = mongoose.model("User", UserSchema);
export default User;
