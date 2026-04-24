import { User } from "./models/user";
import { Product } from "./models/product";
import { Order } from "./models/order";
import { ApiAccess } from "./models/apiAccess";
import { ApiKey } from "./models/apiKey";
import { AgentApiPrice } from "./models/agentApiPrice";
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
  // API access
  getAgentApiAccessStatus(userId: string): Promise<{ status: "none" | "pending" | "active" | "revoked"; hasKey: boolean }>;
  requestAgentApiAccess(userId: string): Promise<{ status: "pending" | "active" | "revoked" }>;
  adminListApiAccess(): Promise<any[]>;
  adminPatchAgentApiPricing(userId: string, prices: Record<string, number>): Promise<{ ok: true }>;
  adminIssueAgentApiKey(userId: string): Promise<{ apiKey: string }>;
  adminRevokeAgentApiAccess(userId: string): Promise<{ ok: true }>;
  getApiPriceForAgent(userId: string, productId: string): Promise<number | null>;
  deductAgentBalanceIfSufficient(agentId: string, amount: number): Promise<{ ok: true; before: number; after: number } | { ok: false; available: number }>;
  // Paginated orders for a user: returns orders array, pagination info and completed count
  getOrdersByUser(
    userId: string,
    page?: number,
    limit?: number,
    opts?: { orderSource?: "web" | "api" },
  ): Promise<{ orders: any[]; pagination: { total: number; page: number; limit: number; pages: number }; completedCount: number }>;

  getProducts(): Promise<any[]>;
  createProduct(product: InsertProduct): Promise<any>;

  createOrder(order: InsertOrder & { userId: string }): Promise<any>;
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

    // Use priceOverride if provided and is a number, otherwise use base price
    const finalPrice = typeof order.priceOverride === 'number' ? order.priceOverride : (p.price ?? 0);

    const newOrder = new Order({
      userId: order.userId,
      productId: order.productId,
      price: finalPrice,
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

  async createCompletedOrder(order: InsertOrder & { userId: string; priceOverride?: number; phoneNumber?: string; productName?: string; paymentStatus?: string; statusOverride?: string; orderSource?: "web" | "api"; walletBalanceBefore?: number; walletBalanceAfter?: number }) {
    try {
      const p = await Product.findById(order.productId).lean();
      if (!p) throw new Error("Product not found");

      // Use priceOverride if provided and is a number, otherwise use base price
      const finalPrice = typeof order.priceOverride === 'number' ? order.priceOverride : (p.price ?? 0);

      const newOrder = new Order({
        userId: order.userId,
        productId: order.productId,
        price: finalPrice,
        dataAmount: p.dataAmount,
        status: order.statusOverride || "completed",
        paymentStatus: order.paymentStatus || "success",
        phoneNumber: order.phoneNumber || undefined,
        productName: order.productName || p.name,
        orderSource: order.orderSource || "web",
        walletBalanceBefore: typeof order.walletBalanceBefore === "number" ? order.walletBalanceBefore : undefined,
        walletBalanceAfter: typeof order.walletBalanceAfter === "number" ? order.walletBalanceAfter : undefined,
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

  async getOrdersByUser(userId: string, page = 1, limit = 10, opts?: { orderSource?: "web" | "api" }) {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = { userId };
    if (opts?.orderSource) filter.orderSource = opts.orderSource;
    const [docs, total, completedCount] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
      Order.countDocuments({ ...filter, status: { $in: ["completed", "delivered"] } }),
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

  async getAgentApiAccessStatus(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return { status: "none" as const, hasKey: false };
    const access = await ApiAccess.findOne({ userId }).lean();
    if (!access) return { status: "none" as const, hasKey: false };
    const hasKey = (await ApiKey.countDocuments({ userId, status: "active" })) > 0;
    return { status: (access as any).status as any, hasKey };
  }

  async requestAgentApiAccess(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
    const existing = await ApiAccess.findOne({ userId }).lean();
    if (existing) {
      // If revoked, allow re-request (goes back to pending)
      if ((existing as any).status === "revoked") {
        await ApiAccess.updateOne({ userId }, { $set: { status: "pending", requestedAt: new Date(), revokedAt: null } });
        return { status: "pending" as const };
      }
      return { status: (existing as any).status as any };
    }
    await ApiAccess.create({ userId, status: "pending", requestedAt: new Date() });
    return { status: "pending" as const };
  }

  async adminListApiAccess() {
    const [accessDocs, products] = await Promise.all([
      ApiAccess.find().sort({ requestedAt: -1 }).lean(),
      Product.find().lean(),
    ]);
    const productList = products.map((p: any) => ({
      id: p._id?.toString(),
      name: p.name,
      network: p.network,
      dataAmount: p.dataAmount,
      agentPrice: p.agentPrice ?? p.price ?? 0,
    }));

    const rows = await Promise.all(
      accessDocs.map(async (a: any) => {
        const userId = a.userId?.toString();
        const u = await User.findById(userId).select("username email balance").lean();
        const key = await ApiKey.findOne({ userId, status: "active" }).sort({ createdAt: -1 }).lean();
        const priceDocs = await AgentApiPrice.find({ userId }).lean();
        const productPrices: Record<string, number> = {};
        for (const pd of priceDocs as any[]) {
          const pid = (pd.productId || "").toString();
          if (pid) productPrices[pid] = pd.price;
        }
        return {
          userId,
          username: (u as any)?.username,
          email: (u as any)?.email,
          status: a.status,
          balance: (u as any)?.balance ?? 0,
          requestedAt: a.requestedAt ? new Date(a.requestedAt).toISOString() : undefined,
          lastUsedAt: (key as any)?.lastUsedAt ? new Date((key as any).lastUsedAt).toISOString() : undefined,
          productPrices,
          products: productList,
        };
      }),
    );
    return rows;
  }

  async adminPatchAgentApiPricing(userId: string, prices: Record<string, number>) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
    const entries = Object.entries(prices || {}).filter(([, v]) => typeof v === "number" && isFinite(v) && v > 0);
    for (const [productId, price] of entries) {
      if (!mongoose.Types.ObjectId.isValid(productId)) continue;
      await AgentApiPrice.updateOne(
        { userId, productId },
        { $set: { price } },
        { upsert: true },
      );
    }
    return { ok: true as const };
  }

  async adminIssueAgentApiKey(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
    // Ensure access record exists and is not revoked
    const access = await ApiAccess.findOne({ userId }).lean();
    if (!access) throw new Error("Agent has not requested API access");
    if ((access as any).status === "revoked") {
      // Allow admin to re-activate by issuing a new key
      await ApiAccess.updateOne({ userId }, { $set: { status: "active", activatedAt: new Date(), revokedAt: null } });
    } else if ((access as any).status !== "active") {
      await ApiAccess.updateOne({ userId }, { $set: { status: "active", activatedAt: new Date() } });
    }

    const { generateApiKey } = await import("./apiKeyAuth");
    const { token, prefix, tokenHash } = generateApiKey();

    // Revoke existing active keys for this user (regenerate behavior)
    await ApiKey.updateMany({ userId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } });
    await ApiKey.create({ userId, prefix, tokenHash, status: "active" });

    return { apiKey: token };
  }

  async adminRevokeAgentApiAccess(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
    await ApiAccess.updateOne({ userId }, { $set: { status: "revoked", revokedAt: new Date() } }, { upsert: true });
    await ApiKey.updateMany({ userId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } });
    return { ok: true as const };
  }

  async getApiPriceForAgent(userId: string, productId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    if (!mongoose.Types.ObjectId.isValid(productId)) return null;
    const override = await AgentApiPrice.findOne({ userId, productId }).lean();
    if (override && typeof (override as any).price === "number") return (override as any).price;
    const p = await Product.findById(productId).lean();
    if (!p) return null;
    const fallback = (p as any).agentPrice ?? (p as any).price ?? null;
    return typeof fallback === "number" ? fallback : null;
  }

  async deductAgentBalanceIfSufficient(agentId: string, amount: number) {
    if (!mongoose.Types.ObjectId.isValid(agentId)) throw new Error("Invalid agent id");
    const amt = Math.abs(Number(amount) || 0);
    if (!isFinite(amt) || amt <= 0) throw new Error("Invalid amount");
    const updated = await User.findOneAndUpdate(
      { _id: agentId, balance: { $gte: amt } },
      { $inc: { balance: -amt } },
      { new: true },
    ).lean();
    if (!updated) {
      const u = await User.findById(agentId).select("balance").lean();
      return { ok: false as const, available: Number((u as any)?.balance ?? 0) };
    }
    const after = Number((updated as any).balance ?? 0);
    const before = after + amt;
    return { ok: true as const, before, after };
  }
}

export const storage = new DatabaseStorage();

export const sessionStore = MongoStore.create({ mongoUrl: process.env.DATABASE_URL });
export default storage;
