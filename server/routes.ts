import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, normalizeUser } from "./auth";
import { verifyJWT } from "./jwt";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

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

    if (!signature || signature !== hmac) {
      console.warn("Invalid Paystack webhook signature");
      return res.status(400).send("Invalid signature");
    }

    try {
      const payload = JSON.parse(raw.toString());
      const event = payload.event;
      const data = payload.data;

      if (event === "charge.success") {
        const metadata = data.metadata || {};
        const amount = data.amount; // in smallest currency unit (pesewas)
        if (metadata.type === "wallet") {
          const agentId = metadata.agentId;
          if (agentId) {
            // Credit agent balance by amount (pesewas converted to main currency)
            await (storage as any).creditAgentBalance(agentId, amount / 100);
          }
        }

        if (metadata.type === "order") {
          const userId = metadata.userId;
          const cart = metadata.cart || [];
          
          if (userId && cart.length > 0) {
            const { Product } = await import("./models/product");
            const { Order } = await import("./models/order");
            const portal02Service = (await import("./services/portal02Service")).default;

            for (const item of cart) {
              const qty = item.quantity || 1;
              for (let i = 0; i < qty; i++) {
                const p = await Product.findById(item.productId).lean();
                const phoneNumber = item.phoneNumber || "";
                const orderRef = `ORD-${Date.now()}-${i}`;

                const order = await (storage as any).createCompletedOrder({
                  productId: item.productId,
                  userId,
                  phoneNumber,
                  paymentStatus: "success",
                  productName: p?.name,
                  statusOverride: p && phoneNumber ? "processing" : undefined,
                });

                if (p && phoneNumber && portal02Service) {
                  try {
                    const vendorResult = await portal02Service.purchaseDataBundleWithRetry(
                      phoneNumber,
                      p.dataAmount,
                      p.network,
                      orderRef
                    );
                    await Order.findByIdAndUpdate(order.id, {
                      $set: {
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
                    console.error("[Webhook] Portal-02 failed:", vendorErr?.message);
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
            await (storage as any).clearCart(userId);
          }
        }
      }

      res.json({ status: true });
    } catch (err) {
      console.error("Webhook processing error:", err);
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

      const updated = await Order.findOneAndUpdate(
        {
          $or: [
            { vendorOrderId: orderId },
            { vendorOrderId: reference },
            { "processingResults.transactionId": orderId },
            { "processingResults.transactionId": reference },
            { "processingResults.reference": orderId },
            { "processingResults.reference": reference },
          ],
        },
        {
          $set: { status: ourStatus },
          $push: {
            webhookHistory: {
              event: processed.event,
              orderId,
              reference,
              status,
              recipient: processed.recipient,
              volume: processed.volume,
              timestamp: processed.timestamp,
            },
          },
        },
        { new: true }
      );

      if (updated) {
        console.log(`[Portal02] Order ${updated._id} updated to ${ourStatus}`);
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
    const user = (req as any).user as any;
    const userId = user.id;
    const { paymentMethod = 'paystack' } = req.body;

    const cart = await storage.getCart(userId);
    console.log(`[Checkout] ===== CHECKOUT START =====`);
    console.log(`[Checkout] User: ${userId}, Cart items: ${cart.length}`);
    console.log(`[Checkout] Full cart: ${JSON.stringify(cart)}`);
    
    if (!cart || cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    // compute total with role-specific pricing
    let total = 0;
    const productsMap: Record<string, any> = {};
    const role = user.role;
    for (const item of cart) {
      const p = await (await import('./models/product')).Product.findById(item.productId).lean();
      if (!p) continue;
      productsMap[item.productId] = p;
      const perItemPrice = role === 'agent' ? p.agentPrice : p.userPrice;
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
        const perItemPrice = (role === 'agent') ? p.agentPrice : p.userPrice;
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
              statusOverride: p && phoneNumber ? "processing" : undefined,
            });
            console.log(`[Checkout] Created order: ${JSON.stringify(order)}`);
            created.push(order);
            if (p && phoneNumber && portal02Service) {
              try {
                const vendorResult = await portal02Service.purchaseDataBundleWithRetry(
                  phoneNumber,
                  p.dataAmount,
                  p.network,
                  `ORD-${order.id}-${Date.now()}`
                );
                await Order.findByIdAndUpdate(order.id, {
                  $set: {
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

    const baseUrl = process.env.FRONTEND_URL || (req.protocol + '://' + req.get('host') || 'http://localhost:5000');
    const callbackUrl = `${baseUrl}/payment-return`;

    try {
      const resp = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total * 100,
          email: user.email || user.username || '',
          currency: 'GHS',
          callback_url: callbackUrl,
          metadata: { type: 'order', userId, cart },
        }),
      });
      const data = await resp.json();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ message: 'Paystack initialization failed' });
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

      const priceForRole = user.role === 'agent' ? prod?.agentPrice : prod?.userPrice;
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
      const priceForRole = (user.role === 'agent') ? p.agentPrice : p.userPrice;
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
    const { orders, pagination, completedCount } = await storage.getOrdersByUser(userId, page, limit);
    const { Product } = await import('./models/product');
    const enrichedOrders = await Promise.all(
      orders.map(async (order: any) => {
        try {
          const product = await Product.findById(order.productId).lean();
          return {
            ...order,
            productName: order.productName || product?.name || 'Unknown Product',
            productNetwork: product?.network || '',
            dataAmount: order.dataAmount || product?.dataAmount,
            phoneNumber: order.phoneNumber,
            createdAt: order.createdAt,
            status: order.status,
            paymentStatus: order.paymentStatus,
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
      const enriched = {
        ...order,
        productName: order.productName || product?.name || 'Unknown',
        productNetwork: product?.network || '',
        dataAmount: order.dataAmount || product?.dataAmount,
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
