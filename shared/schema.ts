import { z } from "zod";

export const insertUserSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Valid email address is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits').optional(),
    role: z.enum(["admin", "agent", "user"]).optional(),
  });

export const userResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  role: z.enum(["admin", "agent", "user"]),
  isVerified: z.boolean(),
  balance: z.number(),
  totalOrdersToday: z.number().optional(),
  totalGBSentToday: z.number().optional(),
  totalSpentToday: z.number().optional(),
  totalGBPurchased: z.number().optional(),
  cart: z.array(z.object({ productId: z.string(), quantity: z.number() })).optional(),
});

export const insertProductSchema = z.object({
  name: z.string(),
  network: z.string(),
  dataAmount: z.string(),
  // Removed base price - only use role-specific prices
  price: z.number().optional(),
  userPrice: z.number().optional(),
  agentPrice: z.number().optional(),
  description: z.string().optional(),
});

export const productResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  network: z.string(),
  dataAmount: z.string(),
  price: z.number(),
  userPrice: z.number().nullable().optional(),
  agentPrice: z.number().nullable().optional(),
  description: z.string().nullable(),
});

export const insertOrderSchema = z.object({
  productId: z.string(),
  // userId will be enforced server-side
});

export const orderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productId: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  createdAt: z.string(),
  productName: z.string().optional(),
  dataAmount: z.string().optional(),
  phoneNumber: z.string().optional(),
  productNetwork: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;
