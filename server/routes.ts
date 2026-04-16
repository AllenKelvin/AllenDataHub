import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, normalizeUser } from "./auth";
import { verifyJWT } from "./jwt";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  verifyApiKeyMiddleware,
  generateApiKeyPlaintext,
  hashApiKey,
  productPricesToRecord,
  resolveApiPrice,
} from "./apiKeyAuth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Authentication (JWT)
  await setupAuth(app);

  // === USER & AGENT ROUTES ===
  
  // List unverified agents (Admin only)
  app.get(api.users.listUnverifiedAgents.path, verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    const agents = await storage.getUnverifiedAgents();
    res.json(agents);
  });

  // List all agents (Admin only)
  app.get("/api/users/agents", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    const agents = await storage.getAllAgents();
    res.json(agents);
  });

  // Admin totals across platform (Admin only)
  app.get("/api/admin/totals", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    // Sum totals across users
    try {
      const mongoose = await import("./db");
      const { User } = await import("./models/user");
      const agg = await User.aggregate([
        {
          $group: {
            _id: null,
            totalOrdersToday: { $sum: "$totalOrdersToday" },
            totalGBSentToday: { $sum: "$totalGBSentToday" },
            totalSpentToday: { $sum: "$totalSpentToday" },
            totalGBPurchased: { $sum: "$totalGBPurchased" },
          },
        },
      ]);
      const totals = agg[0] || { totalOrdersToday: 0, totalGBSentToday: 0, totalSpentToday: 0, totalGBPurchased: 0 };
      res.json(totals);
    } catch (err) {
      res.status(500).json({ message: "Failed to compute totals" });
    }
  });

  // Admin wallet manager: credit an agent's wallet (Admin only)
  // Amount is in GHS: entering 1 credits 1 GHS (not 100 or 1000)
  app.post("/api/admin/wallet/:id/load", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    try {
      const id = req.params.id;
      const { amount } = req.body;
      if (typeof amount !== "number" || amount <= 0) return res.status(400).send({ message: "Invalid amount" });
      const amountGHS = Number(amount);
      const updated = await (storage as any).creditAgentBalance(id, amountGHS);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Admin: list API access requests and configs
  app.get("/api/admin/api-access", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const { User } = await import("./models/user");
      const { Product } = await import("./models/product");
      const configs = await AgentApiConfig.find().sort({ requestedAt: -1 }).lean();
      const products = await Product.find().lean();
      const productList = products.map((p: any) => ({
        id: p._id?.toString(),
        name: p.name,
        network: p.network,
        dataAmount: p.dataAmount,
        agentPrice: p.agentPrice ?? p.price,
      }));
      const out = await Promise.all(
        configs.map(async (c: any) => {
          const u = await User.findById(c.userId).select("username email role isVerified balance").lean();
          return {
            userId: c.userId?.toString(),
            username: u?.username,
            email: u?.email,
            role: u?.role,
            isVerified: u?.isVerified,
            balance: u?.balance,
            status: c.status,
            requestedAt: c.requestedAt,
            lastUsedAt: c.lastUsedAt,
            productPrices: productPricesToRecord(c.productPrices),
            products: productList,
          };
        }),
      );
      res.json(out);
    } catch (err: any) {
      console.error("[admin api-access list]", err?.message);
      res.status(500).json({ message: "Failed to list API access" });
    }
  });

  app.patch("/api/admin/api-access/:userId/pricing", verifyJWT, async (req, res) => {
    const admin = (req as any).user;
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const prices = req.body?.prices;
    if (!prices || typeof prices !== "object") {
      return res.status(400).json({ message: "Body must include prices object: { [productId]: number }" });
    }
    try {
      const mongoose = await import("mongoose");
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const { Product } = await import("./models/product");
      const config = await AgentApiConfig.findOne({ userId: targetUserId });
      if (!config) return res.status(404).json({ message: "No API access request for this agent" });
      const merged: Record<string, number> = { ...productPricesToRecord(config.productPrices) };
      for (const [k, v] of Object.entries(prices as Record<string, unknown>)) {
        if (!mongoose.default.Types.ObjectId.isValid(k)) continue;
        const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
        if (!Number.isFinite(num) || num <= 0) continue;
        const p = await Product.findById(k).lean();
        if (p) merged[k] = num;
      }
      config.productPrices = new Map(Object.entries(merged)) as any;
      await config.save();
      res.json({
        userId: targetUserId,
        productPrices: productPricesToRecord(config.productPrices),
      });
    } catch (err: any) {
      console.error("[admin api-access pricing]", err?.message);
      res.status(500).json({ message: "Failed to save pricing" });
    }
  });

  app.post("/api/admin/api-access/:userId/issue-key", verifyJWT, async (req, res) => {
    const admin = (req as any).user;
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const { User } = await import("./models/user");
      const u = await User.findById(targetUserId).lean();
      if (!u || u.role !== "agent" || !u.isVerified) {
        return res.status(400).json({ message: "Target must be a verified agent" });
      }
      let config = await AgentApiConfig.findOne({ userId: targetUserId });
      if (!config) {
        return res.status(404).json({ message: "Agent has not requested API access yet" });
      }
      if (config.status === "revoked") {
        return res.status(400).json({ message: "API access is revoked; agent must request again" });
      }
      const plaintext = generateApiKeyPlaintext();
      config.keyHash = hashApiKey(plaintext);
      config.status = "active";
      await config.save();
      res.json({
        apiKey: plaintext,
        message: "Store this key securely. It will not be shown again.",
        userId: targetUserId,
      });
    } catch (err: any) {
      console.error("[admin issue-key]", err?.message);
      res.status(500).json({ message: "Failed to issue API key" });
    }
  });

  app.post("/api/admin/api-access/:userId/revoke", verifyJWT, async (req, res) => {
    const admin = (req as any).user;
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const updated = await AgentApiConfig.findOneAndUpdate(
        { userId: targetUserId },
        { $set: { status: "revoked", keyHash: null } },
        { new: true },
      );
      if (!updated) return res.status(404).json({ message: "No API config for this user" });
      res.json({ ok: true, status: "revoked" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to revoke" });
    }
  });

  // Verify Agent (Admin only)
  app.patch(api.users.verifyAgent.path, verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updatedUser = await storage.updateUserVerification(userId, true);
    if (!updatedUser) return res.status(404).send({ message: "User not found" });
    res.json(normalizeUser(updatedUser));
  });

  // Update user profile (email, phoneNumber) - User can update own profile
  app.patch('/api/user/profile', verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    
    const { email, phoneNumber } = req.body;
    try {
      const { User } = await import('./models/user');
      const updates: any = {};
      if (email && typeof email === 'string' && email.includes('@')) {
        updates.email = email;
      }
      if (phoneNumber && typeof phoneNumber === 'string') {
        updates.phoneNumber = phoneNumber;
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }
      
      const updated = await User.findByIdAndUpdate(user.id, updates, { new: true }).lean();
      if (!updated) return res.status(404).json({ message: 'User not found' });
      res.json(normalizeUser(updated));
    } catch (err: any) {
      console.error('[Profile] Update error:', err.message);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Agent: request API access (verified agents only)
  app.post("/api/agent/api-access/request", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(user.id);
    if (!dbUser || dbUser.role !== "agent" || !dbUser.isVerified) {
      return res.status(403).json({ message: "Only verified agents can request API access" });
    }
    try {
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const existing = await AgentApiConfig.findOne({ userId: user.id }).lean();
      if (existing?.status === "active") {
        return res.status(400).json({ message: "You already have an active API key" });
      }
      if (existing?.status === "pending") {
        return res.json({ status: "pending", message: "Your request is already pending admin review" });
      }
      if (existing?.status === "revoked") {
        await AgentApiConfig.findOneAndUpdate(
          { userId: user.id },
          { $set: { status: "pending", keyHash: null } },
        );
        return res.json({ status: "pending", message: "API access request submitted" });
      }
      await AgentApiConfig.create({ userId: user.id, status: "pending" });
      return res.json({ status: "pending", message: "API access request submitted" });
    } catch (err: any) {
      console.error("[API access request]", err?.message);
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  app.get("/api/agent/api-access/status", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "agent") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { AgentApiConfig } = await import("./models/agentApiConfig");
      const doc = await AgentApiConfig.findOne({ userId: user.id }).lean();
      const status = doc?.status ?? "none";
      return res.json({ status, hasKey: status === "active" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load status" });
    }
  });

  // === PRODUCT ROUTES ===

  // Paystack initialize (wallet funding or payment)
  app.post("/api/paystack/initialize", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const { amount, email, metadata } = req.body;
    if (typeof amount !== "number" || !email) return res.status(400).json({ message: "Invalid payload" });
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(500).json({ message: "Paystack not configured" });

    try {
      const resp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, email, currency: "GHS", metadata }),
      });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Paystack initialization failed" });
    }
  });

  // Paystack webhook
  app.post("/api/paystack/webhook", async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(500).send("Paystack not configured");

    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const raw = (req.rawBody as Buffer) || Buffer.from("");
    const crypto = await import("crypto");
    const hmac = crypto.createHmac("sha512", secret).update(raw).digest("hex");

    console.log(`[Webhook] Paystack webhook received. Signature match: ${signature === hmac}`);
    
    if (!signature || signature !== hmac) {
      console.warn(`[Webhook] Invalid Paystack webhook signature. Expected: ${hmac}, Got: ${signature}`);
      return res.status(400).send("Invalid signature");
    }

    try {
      const payload = JSON.parse(raw.toString());
      const event = payload.event;
      const data = payload.data;

      console.log(`[Webhook] Event: ${event}, Amount: ${data.amount}, Status: ${data.status}`);

      if (event === "charge.success") {
        const metadata = data.metadata || {};
        const amount = data.amount; // in smallest currency unit (pesewas)
        console.log(`[Webhook] Charge success. Metadata type: ${metadata.type}, UserId: ${metadata.userId}`);
        
        if (metadata.type === "wallet") {
          const agentId = metadata.agentId;
          if (agentId) {
            const amountInGHS = amount / 100; // Convert pesewas to GHS
            const adminFee = amountInGHS * 0.04; // 4% admin fee
            const amountAfterFee = amountInGHS - adminFee;
            console.log(`[Webhook] Wallet topup for agent ${agentId}. Amount: ${amountInGHS} GHS, Admin Fee (4%): ${adminFee.toFixed(2)} GHS, Net Credit: ${amountAfterFee.toFixed(2)} GHS`);
            // Credit agent balance with amount minus 4% admin fee
            await (storage as any).creditAgentBalance(agentId, amountAfterFee);
          }
        }

        if (metadata.type === "order") {
          const userId = metadata.userId;
          const cart = metadata.cart || [];
          console.log(`[Webhook] Processing order for user ${userId}. Cart items: ${cart.length}`);
          
          if (userId && cart.length > 0) {
            const { Product } = await import("./models/product");
            const { Order } = await import("./models/order");
            const { User } = await import("./models/user");
            const portal02Service = (await import("./services/portal02Service")).default;

            // Get user role for pricing
            const webhookUser = await User.findById(userId).lean();
            const userRole = webhookUser?.role;

            let createdOrdersCount = 0;
            for (const item of cart) {
              const qty = item.quantity || 1;
              for (let i = 0; i < qty; i++) {
                const p = await Product.findById(item.productId).lean();
                const phoneNumber = item.phoneNumber || "";

                // Use role-specific price, fallback to base price if not set
                const priceForRole = userRole === 'agent' 
                  ? (p?.agentPrice ?? p?.price) 
                  : (p?.userPrice ?? p?.price);

                console.log(`[Webhook] Creating order for product ${item.productId}, phone: ${phoneNumber}, network: ${p?.network}`);
                
                const order = await (storage as any).createCompletedOrder({
                  productId: item.productId,
                  userId,
                  phoneNumber,
                  paymentStatus: "success",
                  productName: p?.name,
                  statusOverride: p && phoneNumber ? "pending" : "completed",
                  priceOverride: priceForRole,
                });
                createdOrdersCount++;

                if (p && phoneNumber && portal02Service) {
                  try {
                    const clientRef = `ORD-${order.id}-${Date.now()}`;
                    console.log(`[Webhook] Calling vendor for ${phoneNumber}, ${p.dataAmount}GB ${p.network}, ref=${clientRef}`);
                    const vendorResult = await portal02Service.purchaseDataBundle(
                      phoneNumber,
                      p.dataAmount,
                      p.network,
                      clientRef
                    );
                    console.log(`[Webhook] Vendor result - Success: ${vendorResult.success}, Message: ${vendorResult.message}`);
                    
                    await Order.findByIdAndUpdate(order.id, {
                      $set: {
                        clientOrderReference: clientRef,
                        vendorOrderId: vendorResult.transactionId || vendorResult.reference,
                        "processingResults.0": {
                          itemIndex: 0,
                          success: vendorResult.success,
                          transactionId: vendorResult.transactionId,
                          reference: vendorResult.reference,
                          message: vendorResult.message,
                          error: vendorResult.error,
                          status: vendorResult.status || (vendorResult.success ? "processing" : "failed"),
                        },
                        status: vendorResult.success ? "processing" : "failed",
                      },
                    });
                  } catch (vendorErr: any) {
                    console.error(`[Webhook] Portal-02 failed: ${vendorErr?.message}`);
                    await Order.findByIdAndUpdate(order.id, {
                      $set: {
                        status: "failed",
                        paymentStatus: "success",
                        "processingResults.0": { itemIndex: 0, success: false, error: vendorErr?.message, status: "failed" },
                      },
                    });
                  }
                }
              }
            }
            console.log(`[Webhook] Created ${createdOrdersCount} orders. Clearing cart for user ${userId}`);
            await (storage as any).clearCart(userId);
          }
        }
      }

      res.json({ status: true });
    } catch (err) {
      console.error(`[Webhook] Processing error: ${err}`);
      res.status(500).send("Webhook error");
    }
  });

  // Portal-02 vendor webhook (updates order status from vendor)
  app.post("/api/webhooks/portal02", async (req, res) => {
    try {
      const portal02Service = (await import("./services/portal02Service")).default;
      const processed = portal02Service.processWebhookPayload(req.body);
      if (!processed.success) {
        return res.status(200).send("Event ignored");
      }
      const { orderId, reference, status } = processed;
      const { Order } = await import("./models/order");

      const ourStatus = ["delivered", "resolved"].includes(status) ? "completed" : ["failed", "cancelled", "refunded"].includes(status) ? "failed" : "processing";

      const candidates = [...new Set([orderId, reference].filter((x) => x != null && String(x).trim() !== "").map((x) => String(x)))];
      if (candidates.length === 0) {
        console.warn("[Portal02] Webhook missing orderId/reference; body:", JSON.stringify(req.body).slice(0, 500));
        return res.status(200).send("OK");
      }

      const orConditions = candidates.flatMap((c) => [
        { vendorOrderId: c },
        { clientOrderReference: c },
        { "processingResults.transactionId": c },
        { "processingResults.reference": c },
      ]);

      const statusAt = processed.timestamp instanceof Date && !isNaN(processed.timestamp.getTime()) ? processed.timestamp : new Date();

      const updated = await Order.findOneAndUpdate(
        { $or: orConditions },
        {
          $set: { status: ourStatus, lastStatusUpdateAt: statusAt },
          $push: {
            webhookHistory: {
              event: processed.event,
              orderId: orderId != null ? String(orderId) : "",
              reference: reference != null ? String(reference) : "",
              status,
              recipient: processed.recipient,
              volume: processed.volume,
              timestamp: statusAt,
            },
          },
        },
        { new: true }
      );

      if (updated) {
        console.log(`[Portal02] Order ${updated._id} updated to ${ourStatus} (lastStatusUpdateAt=${statusAt.toISOString()})`);
      } else {
        console.warn(`[Portal02] No order matched webhook candidates: ${candidates.join(", ")}`);
      }
      res.status(200).send("OK");
    } catch (err: any) {
      console.error("[Portal02] Webhook error:", err?.message);
      res.status(200).send("OK");
    }
  });

  // List products (Public/User)
  app.get(api.products.list.path, (req, res, next) => {
    // Optional JWT check - only verify if agent
    const authHeader = req.headers.authorization;
    if (authHeader) {
      verifyJWT(req, res, next);
    } else {
      next();
    }
  }, async (req, res) => {
    // Prevent unverified agents from browsing products
    const user = (req as any).user;
    if (user?.role === 'agent' && !user?.isVerified) {
      return res.status(403).json({ message: 'Agent not verified' });
    }
    const products = await storage.getProducts();
    res.json(products);
  });

  // === CART ROUTES ===

  // Cart and orders are private: always scoped to the authenticated user (Account A cannot see Account B's data)
  app.get('/api/cart', verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = user.id;
    const cart = await storage.getCart(userId);
    const populated = await Promise.all(
      cart.map(async (item: any) => {
        const p = await (await import('./models/product')).Product.findById(item.productId).lean();
        return { product: p ? { ...p, id: p._id?.toString() } : null, quantity: item.quantity, phoneNumber: item.phoneNumber };
      }),
    );
    res.json(populated.filter((i: any) => i.product));
  });

  app.post('/api/cart/add', verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = user.id;
    const { productId, quantity, phoneNumber } = req.body;
    console.log(`[Cart/Add] Request - userId: ${userId}, productId: ${productId}, quantity: ${quantity}, phoneNumber: ${phoneNumber}`);
    if (!productId) return res.status(400).json({ message: 'productId required' });
    await storage.addToCart(userId, productId, quantity || 1, phoneNumber);
    const cart = await storage.getCart(userId);
    console.log(`[Cart/Add] Cart after add: ${JSON.stringify(cart)}`);
    const populated = await Promise.all(
      cart.map(async (item: any) => {
        const p = await (await import('./models/product')).Product.findById(item.productId).lean();
        return { product: p ? { ...p, id: p._id?.toString() } : null, quantity: item.quantity, phoneNumber: item.phoneNumber };
      }),
    );
    res.json(populated.filter((i: any) => i.product));
  });

  app.post('/api/cart/remove', verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = user.id;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: 'productId required' });
    await storage.removeFromCart(userId, productId);
    const cart = await storage.getCart(userId);
    res.json(cart);
  });

  // Clear Cart (private: clear all items for current user)
  app.post('/api/cart/clear', verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = user.id;
    try {
      await storage.clearCart(userId);
      res.json({ status: 'ok', message: 'Cart cleared' });
    } catch (err) {
      console.error('[Cart/Clear] Error clearing cart:', err);
      res.status(500).json({ message: 'Failed to clear cart' });
    }
  });

  app.post('/api/cart/checkout', verifyJWT, async (req, res) => {
    try {
      const user = (req as any).user as any;
      const userId = user.id;
      const { paymentMethod = 'paystack' } = req.body;

      console.log(`[Checkout] ===== CHECKOUT START =====`);
      console.log(`[Checkout] User: ${userId}, Role: ${user.role}, paymentMethod: ${paymentMethod}`);
      
      const cart = await storage.getCart(userId);
      console.log(`[Checkout] Cart items: ${cart.length}, Full cart: ${JSON.stringify(cart)}`);

    // compute total with role-specific pricing
    let total = 0;
    const productsMap: Record<string, any> = {};
    const role = user.role;
    for (const item of cart) {
      const p = await (await import('./models/product')).Product.findById(item.productId).lean();
      if (!p) continue;
      productsMap[item.productId] = p;
      // Use role-specific price, fallback to base price if not set
      const perItemPrice = role === 'agent' ? (p.agentPrice ?? p.price) : (p.userPrice ?? p.price);
      total += (perItemPrice || 0) * (item.quantity || 1);
    }
    console.log(`[Checkout] Total price calculated: ${total}, Payment method: ${paymentMethod}`);

    // WALLET PAYMENT — only agents
    if (paymentMethod === 'wallet') {
      if (role !== 'agent') {
        return res.status(403).json({ message: 'Wallet payment only available for agents' });
      }

      // Use fresh balance from DB so deduction matches actual wallet balance
      const freshUser = await storage.getUser(userId);
      const balance = typeof freshUser?.balance === 'string' ? parseFloat(freshUser.balance) : (freshUser?.balance ?? 0);
      console.log(`[Checkout] Agent ${userId} attempting wallet payment. Balance: ${balance}, Total: ${total}`);
      
      if (balance < total) return res.status(400).json({ message: `Insufficient wallet balance. You need GHS ${total.toFixed(2)}, but have GHS ${balance.toFixed(2)}` });

      // Deduct total from agent wallet (balance and package total both in GHS)
      console.log(`[Checkout] Deducting GHS ${total} from agent wallet`);
      await storage.deductAgentBalance(userId, total);
      
      const { Order } = await import("./models/order");
      const portal02Service = (await import("./services/portal02Service")).default;
      const created: any[] = [];
      console.log(`[Checkout] Processing ${cart.length} cart items for wallet payment`);
      for (const item of cart) {
        console.log(`[Checkout] Processing cart item: ${JSON.stringify(item)}`);
        const p = productsMap[item.productId];
        // Use role-specific price, fallback to base price if not set
        const perItemPrice = (role === 'agent') ? (p.agentPrice ?? p.price) : (p.userPrice ?? p.price);
        const phoneNumber = item.phoneNumber || "";
        console.log(`[Checkout] Item has quantity: ${item.quantity}, will create ${item.quantity || 1} orders`);
        for (let i = 0; i < (item.quantity || 1); i++) {
          try {
            console.log(`[Checkout] Creating order ${i + 1}/${item.quantity || 1} for product ${item.productId}, phone: ${phoneNumber}`);
            const order = await storage.createCompletedOrder({
              productId: item.productId,
              userId,
              priceOverride: perItemPrice,
              phoneNumber,
              productName: p?.name,
              statusOverride: p && phoneNumber ? "pending" : "completed",
            });
            console.log(`[Checkout] Created order: ${JSON.stringify(order)}`);
            created.push(order);
            if (p && phoneNumber && portal02Service) {
              try {
                const clientRef = `ORD-${order.id}-${Date.now()}`;
                const vendorResult = await portal02Service.purchaseDataBundle(
                  phoneNumber,
                  p.dataAmount,
                  p.network,
                  clientRef
                );
                await Order.findByIdAndUpdate(order.id, {
                  $set: {
                    clientOrderReference: clientRef,
                    vendorOrderId: vendorResult.transactionId || vendorResult.reference,
                    "processingResults.0": {
                      itemIndex: 0,
                      success: vendorResult.success,
                      transactionId: vendorResult.transactionId,
                      reference: vendorResult.reference,
                      message: vendorResult.message,
                      error: vendorResult.error,
                      status: vendorResult.status || (vendorResult.success ? "processing" : "failed"),
                    },
                    status: vendorResult.success ? "processing" : "failed",
                  },
                });
              } catch (vendorErr: any) {
                console.error("[Checkout] Portal-02 failed:", vendorErr?.message);
                await Order.findByIdAndUpdate(order.id, {
                  $set: { status: "failed", "processingResults.0": { itemIndex: 0, success: false, error: vendorErr?.message, status: "failed" } },
                });
              }
            }
          } catch (err: any) {
            console.error(`[Checkout] Failed to create order for product ${item.productId}: ${err.message}`);
          }
        }
      }

      await storage.clearCart(userId);
      console.log(`[Checkout] Payment successful. Created ${created.length} orders`);
      return res.json({ status: 'ok', message: 'Payment successful', orders: created });

    }

    // PAYSTACK PAYMENT — all users
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(500).json({ message: 'Paystack not configured' });

    // Validate email for Paystack - ONLY use email, never fall back to username
    if (!user.email || typeof user.email !== 'string' || !user.email.includes('@')) {
      console.error(`[Paystack] Invalid email: "${user.email}" for user ${userId}`);
      return res.status(400).json({ message: 'User email is required for Paystack payment. Please update your profile with a valid email address.' });
    }
    const email = user.email;

    const baseUrl = process.env.FRONTEND_URL || (req.protocol + '://' + req.get('host') || 'http://localhost:5000');
    const callbackUrl = `${baseUrl}/payment-return`;

    try {
      const amountInPesewas = Math.round(total * 100);
      console.log(`[Paystack] Initializing with amount: ${total} GHS = ${amountInPesewas} pesewas, email: ${email}`);
      const resp = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPesewas,
          email: email,
          currency: 'GHS',
          callback_url: callbackUrl,
          metadata: { type: 'order', userId, cart },
        }),
      });
      const data = await resp.json();
      console.log(`[Paystack] Full response:`, JSON.stringify(data, null, 2));
      console.log(`[Paystack] Initialize response status=${resp.status}, success=${data.status}, message=${data.message}`);
      if (!resp.ok) {
        console.error(`[Paystack] Initialize failed: ${resp.statusText}`);
        return res.status(400).json({ message: 'Paystack initialization failed', details: data });
      }
      if (data.status === false) {
        console.error(`[Paystack] API returned error: ${data.message}`);
        return res.status(400).json({ message: data.message || 'Paystack initialization failed', details: data });
      }
      return res.json(data);
    } catch (err: any) {
      console.error(`[Paystack] Exception: ${err.message}`);
      return res.status(500).json({ message: 'Paystack initialization failed', error: err.message });
    }
    } catch (err: any) {
      console.error(`[Checkout] Outer catch - Exception: ${err.message}, Stack: ${err.stack}`);
      return res.status(500).json({ message: 'Checkout failed', error: err.message });
    }
  });

  // Create Product (Admin only) - user and agent prices must differ
  app.post(api.products.create.path, verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    try {
      const productData = api.products.create.input.parse(req.body);
      const u = productData.userPrice;
      const a = productData.agentPrice;
      if (u != null && a != null && u === a) {
        return res.status(400).json({ message: "User price and Agent price must be different" });
      }
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // === ORDER ROUTES ===

  // Create Order (User/Agent)
  app.post(api.orders.create.path, verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).send({ message: "Unauthorized" });

    // If agent, check verification
    if (user.role === 'agent' && !user.isVerified) {
       return res.status(403).send({ message: "Agent not verified" });
    }

    try {
      const orderData = api.orders.create.input.parse(req.body);
      // Force userId to be current user
      // Determine role-specific price override if available
      const prod = await (await import('./models/product')).Product.findById(orderData.productId).lean();

      // Use role-specific price, fallback to base price if not set
      const priceForRole = user.role === 'agent' 
        ? (prod?.agentPrice ?? prod?.price) 
        : (prod?.userPrice ?? prod?.price);
      const order = await storage.createOrder({ ...orderData, userId: user.id, priceOverride: priceForRole });
      res.status(201).json(order);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(e.errors);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Pay for order (wallet or Paystack init)
  app.post("/api/orders/pay", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).send({ message: "Unauthorized" });
    const { productId, useWallet } = req.body;
    if (!productId) return res.status(400).json({ message: "productId required" });

    // verify agent
    if (user.role === 'agent' && !user.isVerified) return res.status(403).json({ message: "Agent not verified" });

    const p = await (await import("./models/product")).Product.findById(productId).lean();
    if (!p) return res.status(404).json({ message: "Product not found" });

    // If agent/admin wants to pay with wallet
    if (useWallet && (user.role === 'agent' || user.role === 'admin')) {
      // user.balance is stored as integer smallest unit? ensure it's number
      const balance = (user.balance || 0);
      // Use role-specific price, fallback to base price if not set
      const priceForRole = (user.role === 'agent') 
        ? (p.agentPrice ?? p.price) 
        : (p.userPrice ?? p.price);
      if (!priceForRole || balance < priceForRole) return res.status(400).json({ message: "Insufficient wallet balance" });

      // Deduct and create completed order
      await (storage as any).deductAgentBalance(user._id.toString(), priceForRole);
      const order = await (storage as any).createCompletedOrder({ productId, userId: user._id.toString(), priceOverride: priceForRole });
      return res.json(order);
    }

    // Otherwise initialize Paystack transaction
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(500).json({ message: "Paystack not configured" });

    try {
      const amountToCharge = (user.role === 'agent') ? p.agentPrice : p.userPrice;
      const resp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToCharge, email: user.username ?? "", currency: "GHS", metadata: { type: "order", userId: user._id.toString(), productId } }),
      });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Paystack initialization failed" });
    }
  });

  // List My Orders (private: only current user's orders; 10 per page for user/agent)
  app.get(api.orders.listMyOrders.path, verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).send({ message: "Unauthorized" });
    const userId = user.id;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
    const sourceQ = String(req.query.source || "");
    const sourceOpt =
      sourceQ === "api" || sourceQ === "web" ? ({ orderSource: sourceQ } as const) : undefined;
    const { orders, pagination, completedCount } = await storage.getOrdersByUser(userId, page, limit, sourceOpt);
    const { Product } = await import('./models/product');
    const enrichedOrders = await Promise.all(
      orders.map(async (order: any) => {
        try {
          const product = await Product.findById(order.productId).lean();
          const h = order.webhookHistory;
          const lastWh =
            Array.isArray(h) && h.length > 0 ? h[h.length - 1] : null;
          return {
            ...order,
            productName: order.productName || product?.name || 'Unknown Product',
            productNetwork: product?.network || '',
            dataAmount: order.dataAmount || product?.dataAmount,
            phoneNumber: order.phoneNumber,
            createdAt: order.createdAt,
            status: order.status,
            paymentStatus: order.paymentStatus,
            lastStatusUpdateAt: order.lastStatusUpdateAt ?? null,
            lastVendorWebhook: lastWh
              ? { vendorStatus: lastWh.status, at: lastWh.timestamp }
              : null,
          };
        } catch {
          return order;
        }
      })
    );
    res.json({ orders: enrichedOrders, pagination, completedCount: completedCount ?? 0 });
  });

  // Admin: list ALL orders (50 per page)
  app.get("/api/admin/orders", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden" });
    }
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const { orders: rawOrders, pagination } = await (storage as any).getAllOrders(page, limit);
    const { Product } = await import('./models/product');
    const { User } = await import('./models/user');
    const enriched = await Promise.all(
      rawOrders.map(async (order: any) => {
        const product = await Product.findById(order.productId).lean();
        const orderUser = await User.findById(order.userId).select('username role').lean();
        return {
          ...order,
          productName: order.productName || product?.name || 'Unknown',
          productNetwork: product?.network || '',
          dataAmount: order.dataAmount || product?.dataAmount,
          phoneNumber: order.phoneNumber,
          createdAt: order.createdAt,
          status: order.status,
          price: order.price,
          buyerUsername: orderUser?.username,
          buyerRole: orderUser?.role,
        };
      })
    );
    const totalSpent = enriched.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
    res.json({ orders: enriched, totalSpent, pagination });
  });

  // Get single order by ID (for polling status updates)
  app.get("/api/orders/:id", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).send({ message: "Unauthorized" });
    const orderId = req.params.id;
    
    try {
      const { Order } = await import('./models/order');
      const { Product } = await import('./models/product');
      const order = await Order.findById(orderId).lean();
      
      if (!order) return res.status(404).json({ message: "Order not found" });
      
      // Only allow user to see their own order, admins can see all
      if (user.role !== 'admin' && order.userId.toString() !== user.id && order.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const product = await Product.findById(order.productId).lean();
      const h = (order as any).webhookHistory;
      const lastWh =
        Array.isArray(h) && h.length > 0 ? h[h.length - 1] : null;
      const enriched = {
        ...order,
        id: (order as any)._id?.toString(),
        productName: order.productName || product?.name || 'Unknown',
        productNetwork: product?.network || '',
        dataAmount: order.dataAmount || product?.dataAmount,
        lastStatusUpdateAt: (order as any).lastStatusUpdateAt ?? null,
        lastVendorWebhook: lastWh
          ? { vendorStatus: lastWh.status, at: lastWh.timestamp }
          : null,
      };
      
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // --- Public HTTP API (X-API-Key) for verified agents ---
  
  // Helper: Normalize phone numbers to 10-digit format
  function normalizePhoneNumber(phone: string): { valid: boolean; normalized?: string; error?: string } {
    if (!phone || typeof phone !== "string") {
      return { valid: false, error: "Phone number is required" };
    }
    
    let cleaned = phone.replace(/\D/g, ""); // Remove all non-digits
    
    // Handle different formats
    if (cleaned.startsWith("233") && cleaned.length === 12) {
      // International: 233541234567 → 0541234567
      cleaned = "0" + cleaned.slice(3);
    } else if (cleaned.startsWith("0") && cleaned.length === 10) {
      // Already correct: 0541234567 → 0541234567
      cleaned = cleaned;
    } else if (cleaned.length === 9) {
      // No prefix: 541234567 → 0541234567
      cleaned = "0" + cleaned;
    } else {
      return {
        valid: false,
        error: `Invalid phone format. Expected format: 0XXXXXXXXX (10 digits). Examples: "0541234567", "+233541234567", "541234567". Received: "${phone}"`,
      };
    }
    
    return { valid: true, normalized: cleaned };
  }

  const apiOrderBody = z.object({
    productId: z.string().min(1, "productId is required"),
    phoneNumber: z.string().min(1, "phoneNumber is required"),
  });

  app.get("/api/v1/orders", verifyApiKeyMiddleware, async (req, res) => {
    const ctx = (req as any).apiAgent as import("./apiKeyAuth").ApiAgentContext;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    res.setHeader("X-Request-ID", requestId);
    const userId = ctx.id;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const s = String(req.query.source || "api").toLowerCase();
    let sourceOpt: { orderSource?: "web" | "api" } | undefined;
    if (s === "all") sourceOpt = undefined;
    else if (s === "web") sourceOpt = { orderSource: "web" };
    else sourceOpt = { orderSource: "api" };

    try {
      const { Product } = await import("./models/product");
      const { orders, pagination, completedCount } = await storage.getOrdersByUser(userId, page, limit, sourceOpt);
      const list = await Promise.all(
        orders.map(async (order: any) => {
          const product = await Product.findById(order.productId).lean();
          const h = order.webhookHistory;
          const lastWh =
            Array.isArray(h) && h.length > 0 ? h[h.length - 1] : null;
          return {
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
            orderSource: order.orderSource ?? "web",
            phoneNumber: order.phoneNumber,
            price: order.price,
            productName: order.productName || product?.name || "Unknown",
            productNetwork: product?.network || "",
            dataAmount: order.dataAmount || product?.dataAmount,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            lastStatusUpdateAt: order.lastStatusUpdateAt ?? null,
            lastVendorWebhook: lastWh
              ? { vendorStatus: lastWh.status, at: lastWh.timestamp }
              : null,
          };
        }),
      );
      res.json({ orders: list, pagination, completedCount: completedCount ?? 0, requestId });
    } catch (err: any) {
      console.error("[api/v1/orders GET]", err?.message);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to list orders",
        requestId,
      });
    }
  });

  app.get("/api/v1/orders/:orderId", verifyApiKeyMiddleware, async (req, res) => {
    const ctx = (req as any).apiAgent as import("./apiKeyAuth").ApiAgentContext;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    res.setHeader("X-Request-ID", requestId);
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    try {
      const { Order } = await import("./models/order");
      const { Product } = await import("./models/product");
      const order = await Order.findById(orderId).lean();
      if (!order) return res.status(404).json({ 
        error: "ORDER_NOT_FOUND",
        message: "Order not found",
        orderId,
        requestId,
      });
      if (order.userId.toString() !== ctx.id) {
        return res.status(403).json({ 
          error: "FORBIDDEN",
          message: "You do not have permission to access this order",
          requestId,
        });
      }
      const product = await Product.findById(order.productId).lean();
      const h = (order as any).webhookHistory;
      const lastWh =
        Array.isArray(h) && h.length > 0 ? h[h.length - 1] : null;
      res.json({
        order: {
          id: (order as any)._id?.toString(),
          status: order.status,
          paymentStatus: order.paymentStatus,
          orderSource: (order as any).orderSource ?? "web",
          phoneNumber: order.phoneNumber,
          price: order.price,
          productName: order.productName || product?.name || "Unknown",
          productNetwork: product?.network || "",
          dataAmount: order.dataAmount || product?.dataAmount,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          lastStatusUpdateAt: (order as any).lastStatusUpdateAt ?? null,
          lastVendorWebhook: lastWh
            ? { vendorStatus: lastWh.status, at: lastWh.timestamp }
            : null,
          webhookHistory: h ?? [],
        },
        requestId,
      });
    } catch (err: any) {
      console.error("[api/v1/orders/:id]", err?.message);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to load order",
        requestId,
      });
    }
  });

  app.get("/api/v1/products", verifyApiKeyMiddleware, async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    res.setHeader("X-Request-ID", requestId);
    try {
      const ctx = (req as any).apiAgent as import("./apiKeyAuth").ApiAgentContext;
      const priceMap = productPricesToRecord(ctx.config.productPrices);
      const products = await storage.getProducts();
      const list = products.map((p: any) => {
        const id = p.id || p._id?.toString();
        const apiPrice = resolveApiPrice(id, p, priceMap);
        return {
          id,
          name: p.name,
          network: p.network,
          dataAmount: p.dataAmount,
          description: p.description ?? null,
          apiPrice,
        };
      });
      res.json({ products: list, requestId });
    } catch (err: any) {
      console.error("[api/v1/products]", err?.message);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to list products",
        requestId,
      });
    }
  });

  app.post("/api/v1/orders", verifyApiKeyMiddleware, async (req, res) => {
    const ctx = (req as any).apiAgent as import("./apiKeyAuth").ApiAgentContext;
    const userId = ctx.id;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    res.setHeader("X-Request-ID", requestId);
    
    const parse = apiOrderBody.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ 
        error: "INVALID_REQUEST",
        message: "Invalid request body",
        issues: parse.error.flatten(),
        requestId,
      });
    }
    const { productId, phoneNumber: rawPhoneNumber } = parse.data;
    
    // Validate productId format
    const mongoose = await import("mongoose");
    if (!mongoose.default.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        error: "INVALID_PRODUCT_ID",
        message: "productId must be a valid 24-character MongoDB ObjectId",
        example: "507f1f77bcf86cd799439011",
        received: productId,
        requestId,
      });
    }
    
    // Normalize phone number
    const phoneNorm = normalizePhoneNumber(rawPhoneNumber);
    if (!phoneNorm.valid) {
      return res.status(400).json({
        error: "INVALID_PHONE_NUMBER",
        message: phoneNorm.error,
        requestId,
      });
    }
    const phoneNumber = phoneNorm.normalized!;
    
    try {
      const { Product } = await import("./models/product");
      const { Order } = await import("./models/order");
      const p = await Product.findById(productId).lean();
      if (!p) return res.status(404).json({ 
        error: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        productId,
        requestId,
      });

      const priceMap = productPricesToRecord(ctx.config.productPrices);
      const perItemPrice = resolveApiPrice(productId, p as any, priceMap);
      if (!perItemPrice || perItemPrice <= 0) {
        return res.status(400).json({
          error: "NO_VALID_PRICE",
          message: "No valid API price configured for this product",
          productId,
          suggestion: "Contact support to configure pricing for this product",
          requestId,
        });
      }

      const freshUser = await storage.getUser(userId);
      const balanceBefore =
        typeof freshUser?.balance === "string" ? parseFloat(freshUser.balance) : (freshUser?.balance ?? 0);
      if (balanceBefore < perItemPrice) {
        return res.status(400).json({
          error: "INSUFFICIENT_BALANCE",
          message: "Insufficient wallet balance",
          required: perItemPrice,
          available: balanceBefore,
          shortfall: perItemPrice - balanceBefore,
          suggestion: "Please topup your wallet before placing this order",
          requestId,
        });
      }

      await storage.deductAgentBalance(userId, perItemPrice);
      const afterUser = await storage.getUser(userId);
      const balanceAfter =
        typeof afterUser?.balance === "string" ? parseFloat(afterUser.balance) : (afterUser?.balance ?? 0);

      const portal02Service = (await import("./services/portal02Service")).default;
      const order = await storage.createCompletedOrder({
        productId,
        userId,
        priceOverride: perItemPrice,
        phoneNumber,
        productName: p?.name,
        statusOverride: p && phoneNumber ? "pending" : "completed",
        orderSource: "api",
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: balanceAfter,
      });

      if (p && phoneNumber && portal02Service) {
        try {
          const clientRef = `ORD-${order.id}-${Date.now()}`;
          const vendorResult = await portal02Service.purchaseDataBundle(
            phoneNumber,
            p.dataAmount,
            p.network,
            clientRef,
          );
          await Order.findByIdAndUpdate(order.id, {
            $set: {
              clientOrderReference: clientRef,
              vendorOrderId: vendorResult.transactionId || vendorResult.reference,
              "processingResults.0": {
                itemIndex: 0,
                success: vendorResult.success,
                transactionId: vendorResult.transactionId,
                reference: vendorResult.reference,
                message: vendorResult.message,
                error: vendorResult.error,
                status: vendorResult.status || (vendorResult.success ? "processing" : "failed"),
              },
              status: vendorResult.success ? "processing" : "failed",
            },
          });
        } catch (vendorErr: any) {
          console.error("[api/v1/orders] Portal-02 failed:", vendorErr?.message);
          await Order.findByIdAndUpdate(order.id, {
            $set: {
              status: "failed",
              "processingResults.0": { itemIndex: 0, success: false, error: vendorErr?.message, status: "failed" },
            },
          });
        }
      }

      const finalOrder = await Order.findById(order.id).lean();
      res.status(201).json({
        order: {
          id: order.id,
          status: finalOrder?.status ?? order.status,
          productId,
          phoneNumber,
          price: perItemPrice,
          orderSource: "api",
          walletBalanceBefore: balanceBefore,
          walletBalanceAfter: balanceAfter,
          createdAt: finalOrder?.createdAt,
          lastStatusUpdateAt: finalOrder?.lastStatusUpdateAt ?? null,
          lastVendorWebhook: (() => {
            const h = finalOrder?.webhookHistory;
            if (!Array.isArray(h) || h.length === 0) return null;
            const last = h[h.length - 1] as { status?: string; timestamp?: Date };
            return last?.status != null
              ? { vendorStatus: last.status, at: last.timestamp }
              : null;
          })(),
        },
        requestId,
      });
    } catch (err: any) {
      console.error("[api/v1/orders]", err?.message);
      res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to place order",
        requestId,
        suggestion: "Please contact support with this requestId if the problem persists",
      });
    }
  });

  // Seed Data function
  await seedDatabase();

  // Start daily reset cron
  try {
    const { startDailyReset } = await import("./cron");
    startDailyReset();
  } catch (err) {
    console.warn("Failed to start daily reset:", err);
  }

  return httpServer;
}

async function seedDatabase() {
  // Remove any Vodafone products from the DB to ensure Vodafone is no longer used
  try {
    const { Product } = await import("./models/product");
    await Product.deleteMany({ network: /vodafone/i });
  } catch (err) {
    console.warn("Failed to remove Vodafone products:", err);
  }
  // Seed Admins
  // Ensure admin accounts exist and enforce known credentials
  const admin1 = await storage.getUserByUsername("@Admin001");
  const admin1Hash = await hashPassword("Password100");
  if (!admin1) {
    console.log("Seeding Admin 1...");
    await storage.createUser({
      username: "@Admin001",
      password: admin1Hash,
      role: "admin",
      isVerified: true,
    });
  } else {
    try {
      await storage.updatePassword(admin1.id || admin1._id?.toString(), admin1Hash);
      console.log("Enforced password for @Admin001");
    } catch (e) {
      console.warn("Failed to enforce admin1 password", e);
    }
  }

  const admin2 = await storage.getUserByUsername("@Admin002");
  const admin2Hash = await hashPassword("Password200");
  if (!admin2) {
    console.log("Seeding Admin 2...");
    await storage.createUser({
      username: "@Admin002",
      password: admin2Hash,
      role: "admin",
      isVerified: true,
    });
  } else {
    try {
      await storage.updatePassword(admin2.id || admin2._id?.toString(), admin2Hash);
      console.log("Enforced password for @Admin002");
    } catch (e) {
      console.warn("Failed to enforce admin2 password", e);
    }
  }

  // Seed Products if empty
  const products = await storage.getProducts();
  if (products.length === 0) {
    console.log("Seeding Products...");
    await storage.createProduct({ name: "MTN 1GB", network: "MTN", dataAmount: "1GB", price: 1000, description: "Valid for 30 days" });
    await storage.createProduct({ name: "Telecel 2GB", network: "Telecel", dataAmount: "2GB", price: 1800, description: "Affordable data" });
    await storage.createProduct({ name: "AirtelTigo 5GB", network: "AirtelTigo", dataAmount: "5GB", price: 4000, description: "Big bundle" });
  }
}
