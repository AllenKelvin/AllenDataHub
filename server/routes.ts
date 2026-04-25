import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, normalizeUser } from "./auth";
import { verifyJWT } from "./jwt";
import { verifyApiKey } from "./apiKeyAuth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // === AGENT API ACCESS (JWT protected, used inside dashboard) ===
  app.get("/api/agent/api-access/status", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "agent") return res.status(403).json({ message: "Agents only" });
    if (!user.isVerified) return res.status(403).json({ message: "Agent not verified" });
    const status = await (storage as any).getAgentApiAccessStatus(user.id);
    res.json(status);
  });

  app.post("/api/agent/api-access/request", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "agent") return res.status(403).json({ message: "Agents only" });
    if (!user.isVerified) return res.status(403).json({ message: "Agent not verified" });
    const result = await (storage as any).requestAgentApiAccess(user.id);
    res.json({ message: "Requested", ...result });
  });

  // === ADMIN: API ACCESS MANAGEMENT ===
  app.get("/api/admin/api-access", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const rows = await (storage as any).adminListApiAccess();
    res.json(rows);
  });

  app.patch("/api/admin/api-access/:userId/pricing", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const userId = req.params.userId;
    const prices = (req.body || {}).prices || {};
    try {
      const parsed = z.record(z.string(), z.number()).parse(prices);
      const out = await (storage as any).adminPatchAgentApiPricing(userId, parsed);
      res.json(out);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Invalid pricing payload" });
    }
  });

  app.post("/api/admin/api-access/:userId/issue-key", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const userId = req.params.userId;
    try {
      const issued = await (storage as any).adminIssueAgentApiKey(userId);
      res.json({ apiKey: issued.apiKey, message: "Issued" });
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Could not issue key" });
    }
  });

  app.post("/api/admin/api-access/:userId/revoke", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const userId = req.params.userId;
    try {
      const out = await (storage as any).adminRevokeAgentApiAccess(userId);
      res.json(out);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Could not revoke" });
    }
  });

  // === PUBLIC PARTNER API (API key protected, no subdomain required) ===
  // Base URL: https://allendatahub.com/api/v1/*

  app.get("/api/v1/products", verifyApiKey, async (req, res) => {
    const agent = (req as any).user;
    const products = await storage.getProducts();
    const enriched = await Promise.all(
      products.map(async (p: any) => {
        const apiPrice = await (storage as any).getApiPriceForAgent(agent.id, p.id);
        return {
          id: p.id,
          name: p.name,
          network: p.network,
          dataAmount: p.dataAmount,
          description: p.description ?? null,
          apiPrice: typeof apiPrice === "number" ? apiPrice : (p.agentPrice ?? p.price ?? 0),
        };
      }),
    );
    res.json({ products: enriched });
  });

  function normalizeGhPhone(input: unknown): { ok: true; phone: string } | { ok: false; message: string } {
    const raw = String(input ?? "").trim();
    if (!raw) return { ok: false, message: "phoneNumber is required" };
    const digits = raw.replace(/[^\d]/g, "");
    // +233XXXXXXXXX or 233XXXXXXXXX -> 0XXXXXXXXX
    if (digits.startsWith("233") && digits.length === 12) {
      const rest = digits.slice(3);
      return { ok: true, phone: "0" + rest };
    }
    // 9 digits -> assume missing leading 0
    if (digits.length === 9) return { ok: true, phone: "0" + digits };
    // already 10 digits starting with 0
    if (digits.length === 10 && digits.startsWith("0")) return { ok: true, phone: digits };
    return {
      ok: false,
      message: `Invalid phone format. Expected 0XXXXXXXXX (10 digits). Received: "${raw}"`,
    };
  }

  app.post("/api/v1/orders", verifyApiKey, async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    res.setHeader("X-Request-ID", requestId);

    const agent = (req as any).user;
    const body = req.body || {};
    const { productId } = body;
    const quantity = Math.max(1, Math.min(100, parseInt(String(body.quantity ?? "1"), 10) || 1));
    const phoneRes = normalizeGhPhone(body.phoneNumber);
    if (!phoneRes.ok) return res.status(400).json({ error: "INVALID_PHONE_NUMBER", message: phoneRes.message, requestId });
    const phoneNumber = phoneRes.phone;

    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ error: "INVALID_PRODUCT_ID", message: "productId is required", requestId });
    }
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

    const { Product } = await import("./models/product");
    const p = await Product.findById(productId).lean();
    if (!p) return res.status(404).json({ error: "PRODUCT_NOT_FOUND", message: "Product not found", productId, requestId });

    const unitPrice = (await (storage as any).getApiPriceForAgent(agent.id, productId)) ?? (p.agentPrice ?? p.price ?? 0);
    const total = Number(unitPrice) * quantity;
    if (!isFinite(total) || total <= 0) return res.status(400).json({ error: "INVALID_PRICE", message: "Invalid price configuration", requestId });

    // Deduct wallet atomically
    const deducted = await (storage as any).deductAgentBalanceIfSufficient(agent.id, total);
    if (!deducted.ok) {
      return res.status(400).json({
        error: "INSUFFICIENT_BALANCE",
        message: "Insufficient wallet balance",
        required: Number(total.toFixed(2)),
        available: Number((deducted as any).available ?? 0),
        shortfall: Number((total - Number((deducted as any).available ?? 0)).toFixed(2)),
        suggestion: "Please topup your wallet before placing this order",
        requestId,
      });
    }

    const { Order } = await import("./models/order");
    const portal02Service = (await import("./services/portal02Service")).default;

    // Create orders (one per quantity), return first order as primary
    const created: any[] = [];
    for (let i = 0; i < quantity; i++) {
      const order = await (storage as any).createCompletedOrder({
        productId,
        userId: agent.id,
        phoneNumber,
        productName: (p as any).name,
        statusOverride: phoneNumber ? "pending" : "completed",
        paymentStatus: "success",
        priceOverride: unitPrice,
        orderSource: "api",
        walletBalanceBefore: i === 0 ? deducted.before : undefined,
        walletBalanceAfter: i === quantity - 1 ? deducted.after : undefined,
      });
      created.push(order);

      // Trigger vendor call (best-effort)
      if (portal02Service && phoneNumber) {
        try {
          const clientRef = `ORD-${order.id}-${Date.now()}`;
          const vendorResult = await portal02Service.purchaseDataBundle(
            phoneNumber,
            (p as any).dataAmount,
            (p as any).network,
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
          await Order.findByIdAndUpdate(order.id, {
            $set: {
              status: "failed",
              "processingResults.0": { itemIndex: 0, success: false, error: vendorErr?.message, status: "failed" },
            },
          });
        }
      }
    }

    const first = created[0];
    const enriched = {
      ...first,
      productNetwork: (p as any).network,
      dataAmount: (p as any).dataAmount,
      phoneNumber,
      price: unitPrice,
      orderSource: "api",
    };
    return res.status(201).json({ order: enriched, requestId });
  });

  app.get("/api/v1/orders", verifyApiKey, async (req, res) => {
    const agent = (req as any).user;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const source = String(req.query.source || "api");
    const sourceOpt =
      source === "api" || source === "web" ? ({ orderSource: source } as const) : undefined;
    const opts = source === "all" ? undefined : sourceOpt;
    const { orders, pagination, completedCount } = await storage.getOrdersByUser(agent.id, page, limit, opts);
    res.json({ orders, pagination, completedCount });
  });

  app.get("/api/v1/orders/:orderId", verifyApiKey, async (req, res) => {
    const agent = (req as any).user;
    const orderId = req.params.orderId;
    const { Order } = await import("./models/order");
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String((order as any).userId) !== String(agent.id)) return res.status(403).json({ message: "Forbidden" });
    res.json({ ...order, id: (order as any)._id?.toString(), userId: (order as any).userId?.toString() });
  });

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

      // Idempotency check: check if this payment reference was already processed
      const paymentReference = data.reference;
      if (paymentReference) {
        const { Order } = await import("./models/order");
        const existingOrder = await Order.findOne({ paymentReference }).lean();
        if (existingOrder) {
          console.log(`[Webhook] Duplicate webhook detected. Order ${existingOrder._id} already exists for payment reference ${paymentReference}. Skipping.`);
          return res.status(200).json({ status: true, message: "Duplicate webhook ignored" });
        }
      }

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
                  paymentReference: paymentReference,
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

  // Admin: update order status (Admin only)
  app.patch("/api/admin/orders/:id/status", verifyJWT, async (req, res) => {
    const user = (req as any).user;
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id;
    const status = String((req.body || {}).status || "").trim();
    const allowed = new Set(["pending", "processing", "completed", "failed"]);
    if (!allowed.has(status)) return res.status(400).json({ message: "Invalid status" });
    const { Order } = await import("./models/order");
    const updated = await Order.findByIdAndUpdate(id, { $set: { status, lastStatusUpdateAt: new Date() } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json({ ...updated, id: (updated as any)._id?.toString() });
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
