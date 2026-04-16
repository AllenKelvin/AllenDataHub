import type { Express, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import crypto from "crypto";

export interface AgentRequest extends Request {
  agentUserId?: string;
  agentApiKey?: string;
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

function requestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizePhone(phone: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("233") && cleaned.length === 12) {
    return "0" + cleaned.slice(3);
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return cleaned;
  }
  if (cleaned.length === 9) {
    return "0" + cleaned;
  }

  return null;
}

export async function simpleApiKeyAuth(
  req: AgentRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "MISSING_API_KEY",
      message: "Missing X-API-Key header. Add: X-API-Key: your_api_key_here",
      docs: "https://docs.allendatahub.com/agent-api",
    });
  }

  try {
    const { AgentApiConfig } = await import("./models/agentApiConfig");
    const config = await AgentApiConfig.findOne({
      keyHash: hashApiKey(apiKey),
      status: "active",
    }).lean();

    if (!config) {
      return res.status(401).json({
        error: "INVALID_API_KEY",
        message: "API key is invalid or inactive",
        docs: "https://docs.allendatahub.com/agent-api",
      });
    }

    const { User } = await import("./models/user");
    const user = await User.findById(config.userId).lean();

    if (!user || user.role !== "agent" || !user.isVerified) {
      return res.status(403).json({
        error: "ACCOUNT_NOT_VERIFIED",
        message: "Your account is not verified yet",
        suggestion: "Contact support@allendatahub.com to verify your account",
      });
    }

    req.agentUserId = config.userId.toString();
    req.agentApiKey = apiKey;
    next();
  } catch (err: any) {
    console.error("[Auth]", err.message);
    res.status(500).json({
      error: "AUTH_ERROR",
      message: "Authentication failed",
    });
  }
}

export async function registerSimplifiedAgentRoutes(app: Express) {
  // Health Check
  app.get("/agent-api/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "AllenDataHub Agent API",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Create Order
  app.post(
    "/agent-api/orders/create",
    simpleApiKeyAuth,
    async (req: AgentRequest, res: Response) => {
      const rid = requestId();
      res.setHeader("X-Request-ID", rid);

      const { productId, phoneNumber, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({
          error: "MISSING_PRODUCT_ID",
          message: "productId is required",
          example: { productId: "507f1f77bcf86cd799439011" },
        });
      }

      if (!phoneNumber) {
        return res.status(400).json({
          error: "MISSING_PHONE",
          message: "phoneNumber is required",
          example: { phoneNumber: "0541234567" },
        });
      }

      const normalizedPhoneNum = normalizePhone(phoneNumber);
      if (!normalizedPhoneNum) {
        return res.status(400).json({
          error: "INVALID_PHONE",
          message: `Invalid phone format: "${phoneNumber}"`,
          help: "Use format like: 0541234567 or +233541234567",
          formats_accepted: [
            "0541234567",
            "541234567",
            "+233541234567",
            "233541234567",
            "0541 234 567",
          ],
        });
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          error: "INVALID_PRODUCT_ID",
          message: "productId must be a valid MongoDB ObjectId",
          example: "507f1f77bcf86cd799439011",
        });
      }

      try {
        const { Product } = await import("./models/product");
        const { Order } = await import("./models/order");
        const storage = (await import("./storage")).default;

        const product = await Product.findById(productId).lean();
        if (!product) {
          return res.status(404).json({
            error: "PRODUCT_NOT_FOUND",
            message: `Product "${productId}" not found`,
            help: "Get available products from: GET /agent-api/products",
          });
        }

        const user = await storage.getUser(req.agentUserId!);
        const balance =
          typeof user?.balance === "string"
            ? parseFloat(user.balance)
            : user?.balance || 0;
        const productPrice = product.price || 0;
        const totalPrice = productPrice * quantity;

        if (balance < totalPrice) {
          return res.status(400).json({
            error: "INSUFFICIENT_BALANCE",
            message: "Not enough wallet balance",
            required: totalPrice,
            available: balance,
            shortfall: totalPrice - balance,
            help: "Topup your wallet or reduce quantity",
          });
        }

        await storage.deductAgentBalance(req.agentUserId!, totalPrice);

        const order = await storage.createCompletedOrder({
          productId,
          userId: req.agentUserId!,
          priceOverride: totalPrice,
          phoneNumber: normalizedPhoneNum,
          productName: product.name,
          statusOverride: "pending",
          orderSource: "api",
          walletBalanceBefore: balance,
          walletBalanceAfter: balance - totalPrice,
        });

        const orderId =
          (order as any)._id?.toString() || (order as any).id || "unknown";

        let vendorOrderId = null;
        try {
          const portal02Service = (await import("./services/portal02Service"))
            .default;
          if (portal02Service) {
            const vendorResult = await portal02Service.purchaseDataBundle(
              normalizedPhoneNum,
              product.dataAmount,
              product.network,
              `ORD-${orderId}`
            );

            if (vendorResult.success) {
              vendorOrderId =
                vendorResult.transactionId || vendorResult.reference;
              await Order.updateOne(
                { _id: orderId },
                {
                  $set: {
                    vendorOrderId,
                    status: "processing",
                  },
                }
              );
            }
          }
        } catch (err: any) {
          console.error("[Vendor]", err.message);
        }

        return res.status(201).json({
          success: true,
          order: {
            id: orderId,
            orderId: orderId,
            status: "pending",
            phoneNumber: normalizedPhoneNum,
            product: {
              name: product.name,
              network: product.network,
              dataAmount: product.dataAmount,
              price: product.price,
            },
            quantity,
            totalPrice,
            vendorOrderId,
            createdAt: new Date().toISOString(),
          },
          message: "Order created successfully",
          requestId: rid,
        });
      } catch (err: any) {
        console.error("[Create Order]", err.message);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "Failed to create order",
          requestId: rid,
          help: "Contact support with this requestId",
        });
      }
    }
  );

  // Get Order
  app.get(
    "/agent-api/orders/:orderId",
    simpleApiKeyAuth,
    async (req: AgentRequest, res: Response) => {
      const rid = requestId();
      res.setHeader("X-Request-ID", rid);

      const orderId = Array.isArray(req.params.orderId)
        ? req.params.orderId[0]
        : req.params.orderId;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          error: "INVALID_ORDER_ID",
          message: "orderId must be a valid MongoDB ObjectId",
        });
      }

      try {
        const { Order } = await import("./models/order");
        const { Product } = await import("./models/product");

        const order = await Order.findById(orderId).lean();
        if (!order) {
          return res.status(404).json({
            error: "ORDER_NOT_FOUND",
            message: `Order "${orderId}" not found`,
          });
        }

        if ((order as any).userId.toString() !== req.agentUserId) {
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "You cannot access this order",
          });
        }

        const product = await Product.findById((order as any).productId).lean();
        const orderIdStr = (order as any)._id?.toString();

        return res.json({
          success: true,
          order: {
            id: orderIdStr,
            orderId: orderIdStr,
            status: (order as any).status,
            phoneNumber: (order as any).phoneNumber,
            product: {
              name: product?.name,
              network: product?.network,
              dataAmount: product?.dataAmount,
            },
            price: (order as any).price,
            vendorOrderId: (order as any).vendorOrderId,
            createdAt: (order as any).createdAt,
            updatedAt: (order as any).updatedAt,
          },
          requestId: rid,
        });
      } catch (err: any) {
        console.error("[Get Order]", err.message);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "Failed to fetch order",
          requestId: rid,
        });
      }
    }
  );

  // List Orders
  app.get(
    "/agent-api/orders",
    simpleApiKeyAuth,
    async (req: AgentRequest, res: Response) => {
      const rid = requestId();
      res.setHeader("X-Request-ID", rid);

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );

      try {
        const storage = (await import("./storage")).default;
        const { orders, pagination } = await storage.getOrdersByUser(
          req.agentUserId!,
          page,
          limit
        );

        return res.json({
          success: true,
          orders: orders.map((o: any) => ({
            id: o.id,
            orderId: o.id,
            status: o.status,
            phone: o.phoneNumber,
            product: o.productName,
            price: o.price,
            vendorOrderId: o.vendorOrderId,
            createdAt: o.createdAt,
          })),
          pagination,
          requestId: rid,
        });
      } catch (err: any) {
        console.error("[List Orders]", err.message);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "Failed to list orders",
          requestId: rid,
        });
      }
    }
  );

  // Get Products
  app.get(
    "/agent-api/products",
    simpleApiKeyAuth,
    async (req: AgentRequest, res: Response) => {
      const rid = requestId();
      res.setHeader("X-Request-ID", rid);

      try {
        const storage = (await import("./storage")).default;
        const products = await storage.getProducts();

        return res.json({
          success: true,
          products: products.map((p: any) => ({
            id: p._id?.toString() || p.id,
            productId: p._id?.toString() || p.id,
            name: p.name,
            network: p.network,
            dataAmount: p.dataAmount,
            price: p.price,
            description: p.description,
          })),
          requestId: rid,
        });
      } catch (err: any) {
        console.error("[List Products]", err.message);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "Failed to list products",
          requestId: rid,
        });
      }
    }
  );

  // Get Balance
  app.get(
    "/agent-api/account/balance",
    simpleApiKeyAuth,
    async (req: AgentRequest, res: Response) => {
      const rid = requestId();
      res.setHeader("X-Request-ID", rid);

      try {
        const storage = (await import("./storage")).default;
        const user = await storage.getUser(req.agentUserId!);
        const balance =
          typeof user?.balance === "string"
            ? parseFloat(user.balance)
            : user?.balance || 0;

        return res.json({
          success: true,
          account: {
            userId: req.agentUserId,
            balance,
            currency: "GHS",
          },
          requestId: rid,
        });
      } catch (err: any) {
        console.error("[Account Balance]", err.message);
        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "Failed to fetch account balance",
          requestId: rid,
        });
      }
    }
  );

  console.log("[Agent API v2.0] Simplified routes registered ✓");
}
