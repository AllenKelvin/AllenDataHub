# AllenDataHub Agent API Developer Guide

This guide explains how agents can integrate the AllenDataHub developer API into their own websites, apps, or middleware.

The API is only for verified agents and is protected by `x-api-key`.

---

## Overview

AllenDataHub exposes a partner API under `/api/v1` that allows verified agents to:

- fetch available data bundles
- create orders on behalf of customers
- deduct the order cost from the agent wallet
- receive order status updates via webhook forwarding

---

## Base URL

- `https://allendatahub.com`
- Agent API path: `/api/v1`

Examples:

- `GET https://allendatahub.com/api/v1/products`
- `POST https://allendatahub.com/api/v1/data/purchase`
- `GET https://allendatahub.com/api/v1/orders/:orderId`

---

## Authentication

All partner API calls must include the agent API key in the `x-api-key` header.

Example:

```http
X-API-Key: adh_live_123abc...
```

If the key is missing, invalid, revoked, or the linked user is not a verified agent, the request will return `401` or `403`.

---

## Agent request flow

1. Agent obtains an API key from the admin dashboard.
2. Agent server fetches products from AllenDataHub.
3. Agent server submits a bundle purchase request.
4. AllenDataHub deducts wallet balance and processes the order.
5. When the order status updates, AllenDataHub forwards the status to the agent-provided webhook.

---

## Endpoints

### 1) Fetch products

`GET /api/v1/products`

Headers:

- `x-api-key`

Response:

```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "MTN 5GB",
      "network": "MTN",
      "dataAmount": "5GB",
      "description": null,
      "apiPrice": 10.5
    }
  ]
}
```

Notes:

- `apiPrice` is the price the agent pays via the API.
- Agents should use the returned `id` when creating an order.

### 2) Purchase data bundle

`POST /api/v1/data/purchase`

Headers:

- `Content-Type: application/json`
- `x-api-key`

Body fields:

- `phoneNumber` (required) — customer phone number
- `network` (required) — one of `MTN`, `Telecel`, `AirtelTigo`
- `volume` (required) — allowed values depend on the network
- `webhookUrl` (optional) — agent callback URL for status forwarding

Example request:

```json
{
  "phoneNumber": "0541234567",
  "network": "MTN",
  "volume": 5,
  "webhookUrl": "https://agent.example.com/allen-webhook"
}
```

Validation rules:

- `phoneNumber` is normalized to Ghana format
- `network` must be one of the supported networks (see below)
- `volume` must match available bundle sizes for the selected network
- `webhookUrl`, if provided, must be a valid URL

There is also basic rate limiting applied to this endpoint:

- `20 requests per minute` per agent

### Purchase response

```json
{
  "success": true,
  "orderId": "65a4c2e8f123456789abcdef",
  "transactionId": "abc123-65a4c2e8f",
  "reference": "API-<agent>-<timestamp>",
  "status": "processing",
  "message": "Order submitted",
  "amount": 10.5,
  "currency": "GHS",
  "webhookUrl": "https://agent.example.com/allen-webhook",
  "walletBalanceBefore": 100,
  "walletBalanceAfter": 89.5,
  "raw": null,
  "requestId": "req_..."
}
```

If the agent wallet does not have enough balance, the response will return `INSUFFICIENT_BALANCE` with details:

```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient wallet balance",
  "required": 10.5,
  "available": 5.0,
  "shortfall": 5.5,
  "suggestion": "Please topup your wallet before placing this order",
  "requestId": "req_..."
}
```

### 3) List agent API orders

`GET /api/v1/orders?page=1&limit=20`

Headers:

- `x-api-key`

This returns orders created by the agent via the public API.

### 4) Get one order

`GET /api/v1/orders/:orderId`

Headers:

- `x-api-key`

Use this to poll status from the agent’s site.

---

## Webhook forwarding

When an order status updates, AllenDataHub performs two actions:

1. updates the order status in the system
2. forwards the status to the agent’s `webhookUrl` if one was provided by the agent when creating the order

The forwarded payload includes:

- `orderId`
- `vendorOrderId`
- `clientOrderReference`
- `status`
- `vendorStatus`
- `phoneNumber`
- `dataAmount`
- `webhookEvent`
- `timestamp`
- `raw`

This means agents can keep their own systems synced without polling.

---

## Allowed networks and volumes

AllenDataHub supports the following networks and bundle sizes:

Supported networks:

- `MTN`
- `Telecel`
- `AirtelTigo`

Supported volumes:

- `MTN`: `1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100`
- `Telecel`: `5, 10, 15, 20, 25, 30, 40, 50, 100`
- `AirtelTigo`: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20`

---

## Agent implementation best practices

### Keep the API key secret

Do not expose `x-api-key` in browser-side JavaScript.

Preferred pattern:

- agent frontend calls agent backend
- agent backend calls AllenDataHub API with `x-api-key`

### Example Node.js server implementation

```js
const BASE_URL = "https://allendatahub.com";
const API_KEY = process.env.ALLENDATAHUB_API_KEY;

async function purchaseBundle({ phoneNumber, network, volume, webhookUrl }) {
  const res = await fetch(`${BASE_URL}/api/v1/data/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ phoneNumber, network, volume, webhookUrl }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Purchase failed");
  }
  return data;
}
```

### Example webhook receiver

```js
app.post("/agent-webhook", express.json(), (req, res) => {
  const payload = req.body;
  console.log("AllenDataHub status update:", payload);
  // Update internal order state here
  res.sendStatus(200);
});
```

---

## Render environment setup

The agent API requires no new environment variables beyond your existing backend setup. However, you **must configure** these values correctly for the agent API to function:

### Required environment variables

These must be set in Render for the agent API to work:

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Your MongoDB connection string | Backend database access |
| `BACKEND_URL` | `https://<your-render-service>.onrender.com` | Order status webhooks + agent API requests |
| `NODE_ENV` | `production` | Enables production mode |

**Critical:** `BACKEND_URL` must be your actual Render service public URL. AllenDataHub uses this to send webhook updates back to your backend, which are then forwarded to agent webhooks.

### Optional environment variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `FRONTEND_URL` | `https://<your-frontend-domain>.vercel.app` | CORS configuration |
| `PORT` | Auto-provided by Render | Server port (usually 10000 on Render) |

### Agent app Render environment
If you deploy your own agent integration on Render and need a server-side connection to AllenDataHub, add these variables to your agent app:

- `ALLENDATAHUB_API_KEY` — your AllenDataHub partner API key
- `ALLENDATAHUB_BASE_URL` — `https://allendatahub.com` (optional; default is the public AllenDataHub API host)

Keep `ALLENDATAHUB_API_KEY` secret and never expose it in browser-side code.

### Render dashboard checklist

When deploying to Render:

1. **Create or update service** with your backend repository
2. **Go to Environment** tab in Render dashboard
3. **Add these required variables:**
   ```
   DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname
   BACKEND_URL=https://your-service-name.onrender.com
   NODE_ENV=production
   ```
4. **Optionally add:**
   ```
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
5. **Redeploy** your service after adding/updating environment variables

### Troubleshooting deployment

**Issue:** Agent API calls fail with 502 or connection errors
- **Check:** Is `BACKEND_URL` set to your Render service public URL?
- **Fix:** Redeploy after setting `BACKEND_URL` in Render dashboard

**Issue:** Webhook forwarding not working
- **Check:** Does `BACKEND_URL` match your actual Render service hostname?
- **Fix:** Verify the URL format: `https://service-name.onrender.com` (no trailing slash)

**Issue:** 401 Unauthorized errors from agent API calls
- **Check:** Is `DATABASE_URL` correct and accessible?
- **Fix:** Verify MongoDB connection string in Render environment

---

## Common error cases

### 401 Unauthorized

- missing or invalid `x-api-key`
- API key revoked
- user is not an agent
- agent is not verified

### 400 Invalid request

- invalid `phoneNumber`
- invalid `network`
- invalid `volume`
- invalid `webhookUrl`

### 429 Rate limit exceeded

- too many purchases within one minute for the same agent
- wait for the `retryAfterSeconds` value before retrying

---

## Summary for agent developers

1. Request an agent API key from the AllenDataHub admin.
2. Keep that key server-side.
3. Fetch products via `GET /api/v1/products`.
4. Purchase bundles via `POST /api/v1/data/purchase`.
5. Provide a `webhookUrl` to receive order status updates.
6. Poll `GET /api/v1/orders/:orderId` only if needed.

---

## Helpful examples

### Direct purchase example

```bash
curl -X POST "https://allendatahub.com/api/v1/data/purchase" \
  -H "Content-Type: application/json" \
  -H "x-api-key: adh_live_123abc" \
  -d '{
    "phoneNumber": "0541234567",
    "network": "MTN",
    "volume": 5,
    "webhookUrl": "https://agent.example.com/allen-webhook"
  }'
```

### Poll order status example

```bash
curl -X GET "https://allendatahub.com/api/v1/orders/65a4c2e8f123456789abcdef" \
  -H "x-api-key: adh_live_123abc"
```

---

## Notes

- The API is agent-only.
- The `data/purchase` endpoint is built for developers who want to integrate a partner store.
- `webhookUrl` is optional, but highly recommended for real-time status updates.
- Use `GET /api/v1/products` to discover valid products and pricing.
