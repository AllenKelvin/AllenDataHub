import { User } from "./models/user";
import { Product } from "./models/product";
import { Order } from "./models/order";
import type { InsertUser, InsertProduct, InsertOrder } from "@shared/schema";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";

export interface IStorage {
  getUser(id: string): Promise<any | null>;
  getUserByUsername(username: string): Promise<any | null>;
  createUser(user: InsertUser & { isVerified?: boolean }): Promise<any>;
  updateUserVerification(id: string, isVerified: boolean): Promise<any | null>;
  getUnverifiedAgents(): Promise<any[]>;
  updatePassword(id: string, newPassword: string): Promise<any | null>;
  // Paginated orders for a user: returns orders array, pagination info and completed count
  getOrdersByUser(userId: string, page?: number, limit?: number): Promise<{ orders: any[]; pagination: { total: number; page: number; limit: number; pages: number }; completedCount: number }>;

  getProducts(): Promise<any[]>;
  createProduct(product: InsertProduct): Promise<any>;

  createOrder(order: InsertOrder & { userId: string }): Promise<any>;
  // Implementation below provides pagination and counts
  getOrdersByUser(userId: string, page?: number, limit?: number): Promise<{ orders: any[]; pagination: { total: number; page: number; limit: number; pages: number }; completedCount: number }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await User.findById(id).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id?.toString() };
  }

  async getUserByUsername(identifier: string) {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    if (!trimmed) return null;
    // Allow lookup by username or email (case-insensitive for imported data)
    const regex = new RegExp('^' + trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const doc = await User.findOne({
      $or: [
        { username: regex },
        { email: regex },
        { username: trimmed },
        { email: trimmed },
      ],
    }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id?.toString() };
  }

  async createUser(insertUser: InsertUser & { isVerified?: boolean }) {
    const user = new User({
      username: insertUser.username,
      email: (insertUser as any).email,
      password: insertUser.password,
      role: insertUser.role || "user",
      isVerified: insertUser.isVerified ?? false,
    });
    const saved = await user.save();
    const obj = saved.toObject();
    return { ...obj, id: (obj as any)._id?.toString() };
  }

  async updateUserVerification(id: string, isVerified: boolean) {
    const updated = await User.findByIdAndUpdate(id, { isVerified }, { new: true }).lean();
    if (!updated) return null;
    return { ...updated, id: (updated as any)._id?.toString() };
  }

  async updatePassword(id: string, newPassword: string) {
    const updated = await User.findByIdAndUpdate(id, { password: newPassword }, { new: true }).lean();
    if (!updated) return null;
    return { ...updated, id: (updated as any)._id?.toString() };
  }

  async getUnverifiedAgents() {
    const docs = await User.find({ role: "agent", isVerified: false }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id?.toString() }));
  }

  async getAllAgents() {
    const docs = await User.find({ role: "agent" }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id?.toString() }));
  }

  // Cart operations
  async getCart(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    const user = await User.findById(userId).lean();
    if (!user) return [];
    const cart = (user.cart || []).map((c: any) => ({ productId: (c.productId || "").toString(), quantity: c.quantity || 1, phoneNumber: c.phoneNumber || undefined }));
    console.log(`[Cart] getCart for user ${userId}: ${JSON.stringify(cart)}`);
    return cart;
  }

  async addToCart(userId: string, productId: string, quantity = 1, phoneNumber?: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    
    // Get current cart
    const user = await User.findById(userId);
    if (!user) return null;
    
    const currentCart = (user.cart || []) as any[];
    console.log(`[CartOp] ===== ADD TO CART START =====`);
    console.log(`[CartOp] User: ${userId}`);
    console.log(`[CartOp] Adding: productId=${productId}, quantity=${quantity}, phoneNumber=${phoneNumber}`);
    console.log(`[CartOp] Current cart before: ${JSON.stringify(currentCart)}`);
    console.log(`[CartOp] Cart length: ${currentCart.length}`);
    
    // Find existing item with same productId AND phoneNumber
    const existingIndex = currentCart.findIndex((item: any) => {
      const itemProdId = item.productId?.toString() || item.productId;
      const match = itemProdId === productId && item.phoneNumber === phoneNumber;
      console.log(`[CartOp]   Comparing: itemProdId='${itemProdId}' vs productId='${productId}', itemPhone='${item.phoneNumber}' vs phone='${phoneNumber}', match=${match}`);
      return match;
    });
    
    console.log(`[CartOp] Existing item index: ${existingIndex}`);
    
    if (existingIndex !== -1) {
      // Increment quantity on existing item
      console.log(`[CartOp] INCREMENTING quantity at index ${existingIndex}`);
      user.cart[existingIndex].quantity = (user.cart[existingIndex].quantity || 1) + quantity;
      
      const saved = await user.save();
      console.log(`[CartOp] After save: ${JSON.stringify(saved.cart)}`);
      return { ok: true };
    }
    
    // Add new cart item
    console.log(`[CartOp] ADDING new cart item`);
    user.cart.push({ productId: new mongoose.Types.ObjectId(productId), quantity, phoneNumber });
    console.log(`[CartOp] After push (before save): ${JSON.stringify(user.cart)}`);
    
    const saved = await user.save();
    console.log(`[CartOp] After save: ${JSON.stringify(saved.cart)}`);
    console.log(`[CartOp] Cart now has ${saved.cart.length} items`);
    return { ok: true };
  }

  async removeFromCart(userId: string, productId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    const updated = await User.findByIdAndUpdate(userId, { $pull: { cart: { productId } } }, { new: true }).lean();
    if (!updated) return null;
    return { ok: true };
  }

  async clearCart(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    const updated = await User.findByIdAndUpdate(userId, { $set: { cart: [] } }, { new: true }).lean();
    if (!updated) return null;
    return { ok: true };
  }

  async getProducts() {
    const docs = await Product.find().lean();
    return docs.map((d: any) => ({ ...d, id: d._id?.toString() }));
  }

  async createProduct(product: InsertProduct) {
    const p = new Product(product);
    const saved = (await p.save()).toObject();
    return { ...saved, id: (saved as any)._id?.toString() };
  }

  async createOrder(order: InsertOrder & { userId: string; priceOverride?: number }) {
    const p = await Product.findById(order.productId).lean();
    if (!p) throw new Error("Product not found");

    const newOrder = new Order({
      userId: order.userId,
      productId: order.productId,
      price: typeof order.priceOverride === 'number' ? order.priceOverride : p.price,
      dataAmount: p.dataAmount,
      status: "pending",
    });

    const saved = await newOrder.save();

    // Update tracking metrics for user
    const gbIncrement = (() => {
      try {
        const s = (p.dataAmount || "").toString().trim().toUpperCase();
        if (s.endsWith("GB")) return parseFloat(s.replace("GB", "")) || 0;
        if (s.endsWith("MB")) return (parseFloat(s.replace("MB", "")) || 0) / 1024;
      } catch (e) {
        return 0;
      }
      return 0;
    })();

    await User.findByIdAndUpdate(order.userId, {
      $inc: { totalOrdersToday: 1, totalSpentToday: p.price, totalGBSentToday: gbIncrement },
    });

    const obj = saved.toObject();
    return { ...obj, id: (obj as any)._id?.toString() };
  }

  async createCompletedOrder(order: InsertOrder & { userId: string; priceOverride?: number; phoneNumber?: string; productName?: string; paymentStatus?: string; statusOverride?: string }) {
    try {
      const p = await Product.findById(order.productId).lean();
      if (!p) throw new Error("Product not found");

      const newOrder = new Order({
        userId: order.userId,
        productId: order.productId,
        price: typeof order.priceOverride === 'number' ? order.priceOverride : p.price,
        dataAmount: p.dataAmount,
        status: order.statusOverride || "completed",
        paymentStatus: order.paymentStatus || "success",
        phoneNumber: order.phoneNumber || undefined,
        productName: order.productName || p.name,
      });

      console.log(`[Order] Attempting to save order: ${JSON.stringify(newOrder.toObject())}`);
      const saved = await newOrder.save();
      console.log(`[Order] ✓ Created order ${saved._id} for user ${order.userId}, product ${order.productId}`);

      const gbIncrement = (() => {
        try {
          const s = (p.dataAmount || "").toString().trim().toUpperCase();
          if (s.endsWith("GB")) return parseFloat(s.replace("GB", "")) || 0;
          if (s.endsWith("MB")) return (parseFloat(s.replace("MB", "")) || 0) / 1024;
        } catch (e) {
          return 0;
        }
        return 0;
      })();

      console.log(`[Order] Incrementing GB by ${gbIncrement} for user ${order.userId}`);
      const updatedUser = await User.findByIdAndUpdate(order.userId, {
        $inc: { totalOrdersToday: 1, totalSpentToday: p.price, totalGBSentToday: gbIncrement, totalGBPurchased: gbIncrement },
      }, { new: true });
      console.log(`[Order] User updated, totalGBPurchased now: ${updatedUser?.totalGBPurchased}`);

      const obj = saved.toObject();
      const result = { ...obj, id: (obj as any)._id?.toString() };
      console.log(`[Order] Returning order: ${JSON.stringify(result)}`);
      return result;
    } catch (err: any) {
      console.error(`[Order] ✗ FAILED to create order: ${err.message}`);
      console.error(`[Order] Error details: ${JSON.stringify(err)}`);
      throw err;
    }
  }

  async deductAgentBalance(agentId: string, amount: number) {
    // Deduct amount from agent balance
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const updated = await User.findByIdAndUpdate(
      agentId, 
      { $inc: { balance: -Math.abs(numAmount) } }, 
      { new: true }
    ).lean();
    if (!updated) return null;
    return { ...updated, id: updated._id?.toString(), balance: typeof updated.balance === 'string' ? parseFloat(updated.balance) : updated.balance };
  }

  async getOrdersByUser(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [docs, total, completedCount] = await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({ userId }),
      Order.countDocuments({ userId, status: { $in: ['completed', 'delivered'] } }),
    ]);
    const orders = docs.map((d: any) => ({ ...d, id: d._id?.toString(), userId: d.userId?.toString() }));
    return { orders, pagination: { total, page, limit, pages: Math.ceil(total / limit) }, completedCount };
  }

  async getAllOrders(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(),
    ]);
    const orders = docs.map((d: any) => ({ ...d, id: d._id?.toString(), userId: d.userId?.toString() }));
    return { orders, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async creditAgentBalance(agentId: string, amount: number) {
    const updated = await User.findByIdAndUpdate(agentId, { $inc: { balance: amount } }, { new: true }).lean();
    if (!updated) return null;
    return { ...updated, id: updated._id?.toString() };
  }
}

export const storage = new DatabaseStorage();

export const sessionStore = MongoStore.create({ mongoUrl: process.env.DATABASE_URL });
export default storage;
