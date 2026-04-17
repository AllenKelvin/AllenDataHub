# AllenDataHub Agent API v2.0 - Partner Integration Guide

**Last Updated:** April 16, 2026  
**API Version:** 2.0 (Simplified)  
**Status:** ✅ Production Ready

---

## 📚 Table of Contents

1. [Quick Start (5 minutes)](#quick-start)
2. [Authentication](#authentication)
3. [Base URL & Headers](#base-url--headers)
4. [All Endpoints](#all-endpoints)
5. [Common Workflows](#common-workflows)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [FAQ](#faq)
9. [Support](#support)

---

## Quick Start

### 1. Get Your API Key

Contact support@allendatahub.com and request Agent API access.

### 2. Test Connection

```bash
curl https://allendatahub.com/agent-api/health

# Response:
{
  "status": "ok",
  "service": "AllenDataHub Agent API",
  "version": "2.0.0"
}
```

### 3. Create Your First Order

```bash
curl -X POST https://allendatahub.com/agent-api/orders/create \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "phoneNumber": "0541234567",
    "quantity": 1
  }'

# Response (201 Created):
{
  "success": true,
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "orderId": "65a4c2e8f123456789abcdef",
    "status": "pending",
    "phoneNumber": "0541234567",
    "product": {
      "name": "MTN 1GB",
      "network": "MTN",
      "dataAmount": "1",
      "price": 2.50
    },
    "quantity": 1,
    "totalPrice": 2.50,
    "vendorOrderId": "txn_abc123",
    "createdAt": "2024-01-15T10:30:45.123Z"
  }
}
```

---

## Authentication

### Simple API Key Auth

Every request must include your API key in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your_api_key_here" https://allendatahub.com/agent-api/...
```

### What Happens Without Auth

```bash
# Missing API Key
curl https://allendatahub.com/agent-api/orders/create

# Response: 401
{
  "error": "MISSING_API_KEY",
  "message": "Missing X-API-Key header. Add: X-API-Key: your_api_key_here",
  "docs": "https://docs.allendatahub.com/agent-api"
}
```

---

## Base URL & Headers

### Base URL
```
https://allendatahub.com
```

### Required Headers
```
X-API-Key: your_api_key_here
Content-Type: application/json
```

### Response Headers
```
X-Request-ID: req_1234567890_abc123  # Use for support tickets
```

---

## All Endpoints

### 1️⃣ Health Check (No Auth)
```
GET /agent-api/health
```

**Use:** Test if API is online

**Response:**
```json
{
  "status": "ok",
  "service": "AllenDataHub Agent API",
  "version": "2.0.0",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

### 2️⃣ Create Order ⭐ (Main Endpoint)
```
POST /agent-api/orders/create
```

**Required Body:**
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "phoneNumber": "0541234567",
  "quantity": 1
}
```

**Phone Number Formats (All Accepted):**
- ✅ `0541234567` (local, recommended)
- ✅ `541234567` (without prefix)
- ✅ `+233541234567` (international)
- ✅ `233541234567` (international without +)
- ✅ `0541 234 567` (with spaces)
- ✅ `0541-234-567` (with dashes)

**Success Response (201 Created):**
```json
{
  "success": true,
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "orderId": "65a4c2e8f123456789abcdef",
    "status": "pending",
    "phoneNumber": "0541234567",
    "product": {
      "name": "MTN 1GB",
      "network": "MTN",
      "dataAmount": "1",
      "price": 2.50
    },
    "quantity": 1,
    "totalPrice": 2.50,
    "vendorOrderId": "txn_abc123",
    "createdAt": "2024-01-15T10:30:45.123Z"
  },
  "message": "Order created successfully",
  "requestId": "req_1705330245123_abc123"
}
```

**Error Response (Insufficient Balance):**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Not enough wallet balance",
  "required": 2.50,
  "available": 1.00,
  "shortfall": 1.50,
  "help": "Topup your wallet or reduce quantity"
}
```

**What `vendorOrderId` Is:**
- ID from the data vendor (e.g., Portal-02)
- Use this to track in vendor system
- You'll receive webhooks using this ID
- Store it to match order updates

---

### 3️⃣ Get Order Status
```
GET /agent-api/orders/:orderId
```

**Example:**
```bash
curl -H "X-API-Key: your_key" \
  https://allendatahub.com/agent-api/orders/65a4c2e8f123456789abcdef
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "orderId": "65a4c2e8f123456789abcdef",
    "status": "processing",
    "phoneNumber": "0541234567",
    "product": {
      "name": "MTN 1GB",
      "network": "MTN",
      "dataAmount": "1"
    },
    "price": 2.50,
    "vendorOrderId": "txn_abc123",
    "createdAt": "2024-01-15T10:30:45.123Z",
    "updatedAt": "2024-01-15T10:31:00.000Z"
  },
  "requestId": "req_1705330245124_def456"
}
```

**Status Values:**
- `pending` → Order created, waiting for vendor
- `processing` → Vendor is processing
- `completed` → Successfully delivered
- `failed` → Order failed

---

### 4️⃣ List Your Orders
```
GET /agent-api/orders?page=1&limit=20
```

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 50

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "65a4c2e8f123456789abcdef",
      "orderId": "65a4c2e8f123456789abcdef",
      "status": "completed",
      "phone": "0541234567",
      "product": "MTN 1GB",
      "price": 2.50,
      "vendorOrderId": "txn_abc123",
      "createdAt": "2024-01-15T10:30:45.123Z"
    },
    {
      "id": "65a4c2e8f123456789abcde2",
      "orderId": "65a4c2e8f123456789abcde2",
      "status": "processing",
      "phone": "0572111111",
      "product": "Telecel 2GB",
      "price": 4.50,
      "vendorOrderId": "txn_def456",
      "createdAt": "2024-01-15T10:25:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  },
  "requestId": "req_1705330245125_ghi789"
}
```

---

### 5️⃣ Get Available Products
```
GET /agent-api/products
```

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "507f1f77bcf86cd799439011",
      "productId": "507f1f77bcf86cd799439011",
      "name": "MTN 1GB",
      "network": "MTN",
      "dataAmount": "1",
      "price": 2.50,
      "description": "1GB valid for 30 days"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "productId": "507f1f77bcf86cd799439012",
      "name": "Telecel 2GB",
      "network": "Telecel",
      "dataAmount": "2",
      "price": 4.50,
      "description": "2GB valid for 30 days"
    }
  ],
  "requestId": "req_1705330245126_jkl012"
}
```

---

### 6️⃣ Check Account Balance
```
GET /agent-api/account/balance
```

**Response:**
```json
{
  "success": true,
  "account": {
    "userId": "69de8c394879b8da8020171d",
    "balance": 50.00,
    "currency": "GHS"
  },
  "requestId": "req_1705330245127_mno345"
}
```

---

## Common Workflows

### Workflow 1: Create Multiple Orders

```typescript
async function createMultipleOrders(phoneNumbers: string[], productId: string) {
  const apiKey = "your_api_key_here";
  const results = [];

  for (const phone of phoneNumbers) {
    try {
      const response = await fetch(
        "https://allendatahub.com/agent-api/orders/create",
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId,
            phoneNumber: phone,
            quantity: 1,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        results.push({
          phone,
          status: "success",
          orderId: data.order.id,
          vendorOrderId: data.order.vendorOrderId,
        });
      } else {
        results.push({
          phone,
          status: "failed",
          error: data.error,
        });
      }
    } catch (err) {
      results.push({
        phone,
        status: "error",
        message: err.message,
      });
    }
  }

  return results;
}

// Usage
const phones = ["0541234567", "0572111111", "0551234567"];
const productId = "507f1f77bcf86cd799439011";
const results = await createMultipleOrders(phones, productId);
console.log(results);
```

---

### Workflow 2: Create Order with Error Handling

```typescript
async function createOrderWithRetry(
  productId: string,
  phoneNumber: string,
  maxRetries = 3
) {
  const apiKey = "your_api_key_here";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        "https://allendatahub.com/agent-api/orders/create",
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId,
            phoneNumber,
            quantity: 1,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          order: data.order,
          requestId: data.requestId,
        };
      }

      // Don't retry on validation errors
      if (response.status === 400) {
        return {
          success: false,
          error: data.error,
          message: data.message,
          requestId: data.requestId,
        };
      }

      // Retry on server errors
      if (response.status >= 500) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // Backoff
          continue;
        }
      }

      return {
        success: false,
        error: data.error,
        message: data.message,
        requestId: data.requestId,
      };
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed:`, err.message);

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      return {
        success: false,
        error: "NETWORK_ERROR",
        message: err.message,
      };
    }
  }
}

// Usage
const result = await createOrderWithRetry(
  "507f1f77bcf86cd799439011",
  "0541234567"
);

if (result.success) {
  console.log("Order created:", result.order.id);
  console.log("Vendor Order ID:", result.order.vendorOrderId);
} else {
  console.error("Order failed:", result.message);
  console.log("Request ID for support:", result.requestId);
}
```

---

## Error Handling

### All Error Codes

| Code | HTTP | Meaning | Solution |
|------|------|---------|----------|
| `MISSING_API_KEY` | 401 | Missing X-API-Key header | Add header: `X-API-Key: your_key` |
| `INVALID_API_KEY` | 401 | Wrong or expired API key | Check your API key format |
| `ACCOUNT_NOT_VERIFIED` | 403 | Account not verified | Contact support to verify |
| `MISSING_PRODUCT_ID` | 400 | Missing productId in body | Include `"productId": "..."` |
| `MISSING_PHONE` | 400 | Missing phoneNumber in body | Include `"phoneNumber": "..."` |
| `INVALID_PHONE` | 400 | Wrong phone format | Use format like `0541234567` |
| `INVALID_PRODUCT_ID` | 400 | productId format wrong | Get from `/agent-api/products` |
| `PRODUCT_NOT_FOUND` | 404 | Product doesn't exist | Verify productId is valid |
| `INSUFFICIENT_BALANCE` | 400 | Not enough wallet balance | Topup wallet or reduce quantity |
| `ORDER_NOT_FOUND` | 404 | Order doesn't exist | Check orderId is correct |
| `FORBIDDEN` | 403 | Cannot access this order | Order belongs to different agent |
| `SERVER_ERROR` | 500 | Server error | Retry with exponential backoff |

### Error Response Format

```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Human readable message",
  "required": 2.50,
  "available": 1.00,
  "help": "Suggestion to fix",
  "requestId": "req_1705330245123_abc123"
}
```

### Handling in Code

```typescript
async function handleOrderCreation(productId: string, phone: string) {
  const response = await fetch(
    "https://allendatahub.com/agent-api/orders/create",
    {
      method: "POST",
      headers: {
        "X-API-Key": "your_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, phoneNumber: phone }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    // Get requestId for support
    const requestId = data.requestId;

    // Handle specific errors
    if (data.error === "INVALID_PHONE") {
      console.error(`Invalid phone: ${phone}`);
      console.error(data.help); // "Use format like 0541234567"
    } else if (data.error === "INSUFFICIENT_BALANCE") {
      console.error(`Need GHS ${data.shortfall} more`);
    } else if (data.error === "PRODUCT_NOT_FOUND") {
      console.error(`Product not found. Get from /agent-api/products`);
    } else {
      console.error(`Error: ${data.message}`);
      console.error(`Contact support with: ${requestId}`);
    }

    return null;
  }

  return data.order;
}
```

---

## Testing

### Test Everything with cURL

**1. Check Health**
```bash
curl https://allendatahub.com/agent-api/health
```

**2. Get Products**
```bash
curl -H "X-API-Key: your_api_key" \
  https://allendatahub.com/agent-api/products
```

**3. Check Balance**
```bash
curl -H "X-API-Key: your_api_key" \
  https://allendatahub.com/agent-api/account/balance
```

**4. Create Order**
```bash
curl -X POST https://allendatahub.com/agent-api/orders/create \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID_FROM_STEP_2",
    "phoneNumber": "0541234567",
    "quantity": 1
  }'
```

**5. Get Your Orders**
```bash
curl -H "X-API-Key: your_api_key" \
  "https://allendatahub.com/agent-api/orders?page=1&limit=10"
```

**6. Get Single Order**
```bash
curl -H "X-API-Key: your_api_key" \
  https://allendatahub.com/agent-api/orders/ORDER_ID_FROM_STEP_4
```

---

## FAQ

**Q: What's the difference between `orderId` and `vendorOrderId`?**

A:
- `orderId`: Your internal order ID (store this)
- `vendorOrderId`: Vendor's (Portal-02) order ID (use to track with vendor)

**Q: How long does order processing take?**

A: Typically 5-30 seconds. Check status with `GET /agent-api/orders/:orderId`

**Q: Can I resend a request if it fails?**

A: Yes, but use exponential backoff (wait 1s, then 2s, then 4s). Check for duplicate orderId to avoid double-creating.

**Q: What phone numbers are accepted?**

A: Any format with Ghanaian numbers:
- `0541234567` ✅
- `+233541234567` ✅
- `541234567` ✅
- `233541234567` ✅
- With spaces/dashes ✅

**Q: How do I track order status updates?**

A: Poll `/agent-api/orders/:orderId` every 10 seconds, OR subscribe to webhooks (contact support).

**Q: What if I get rate limited?**

A: We don't have strict rate limits. Contact support if you exceed 1000 requests/minute.

**Q: Is there a sandbox/test mode?**

A: Use your regular credentials. We mark test orders internally. Contact support for test products.

---

## Support

- **Email:** support@allendatahub.com
- **Slack:** #agent-api-support
- **Documentation:** https://docs.allendatahub.com/agent-api
- **Status:** https://status.allendatahub.com

**Include in Support Tickets:**
- `requestId` from error response
- cURL command that failed
- Expected vs actual response
- Phone number (if applicable)

---

## Example: Complete Integration

```typescript
import fetch from "node-fetch";

const API_KEY = "your_api_key_here";
const BASE_URL = "https://allendatahub.com";

class AllenDataHubAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async health() {
    const res = await fetch(`${BASE_URL}/agent-api/health`);
    return res.json();
  }

  async products() {
    const res = await fetch(`${BASE_URL}/agent-api/products`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async balance() {
    const res = await fetch(`${BASE_URL}/agent-api/account/balance`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async createOrder(productId: string, phoneNumber: string, quantity = 1) {
    const res = await fetch(`${BASE_URL}/agent-api/orders/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ productId, phoneNumber, quantity }),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async orderStatus(orderId: string) {
    const res = await fetch(`${BASE_URL}/agent-api/orders/${orderId}`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async listOrders(page = 1, limit = 20) {
    const res = await fetch(
      `${BASE_URL}/agent-api/orders?page=${page}&limit=${limit}`,
      { headers: this.headers() }
    );
    return res.json();
  }
}

// Usage
const api = new AllenDataHubAPI(API_KEY);

// Check health
console.log(await api.health());

// Get products
const { products } = await api.products();
const productId = products[0].id;

// Create order
const { data: order } = await api.createOrder(productId, "0541234567");

if (order.success) {
  console.log("Order created:", order.order.id);
  console.log("Vendor Order ID:", order.order.vendorOrderId);
} else {
  console.error("Order failed:", order.error, order.message);
}
```

---

**Version 2.0 | April 2026 | AllenDataHub**
