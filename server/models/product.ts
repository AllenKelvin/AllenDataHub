import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    network: { type: String, required: true },
    dataAmount: { type: String, required: true },
    price: { type: Number, required: false },
    // Role-specific prices
    userPrice: { type: Number, required: false },
    agentPrice: { type: Number, required: false },
    description: { type: String, default: null },
  },
  { timestamps: true },
);

export const Product = mongoose.model("Product", ProductSchema);
export default Product;
