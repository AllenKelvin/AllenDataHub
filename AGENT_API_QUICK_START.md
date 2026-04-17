# Agent API v2.0 - Quick Start Guide (5 minutes)

## Step 1: Get Your API Key

Contact: **support@allendatahub.com**

Tell them:
- Your company name
- Your intended use
- Expected transaction volume

They'll send you: `X-API-Key: xxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 2: Test Connection

```bash
curl https://allendatahub.com/agent-api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "AllenDataHub Agent API",
  "version": "2.0.0"
}
```

---

## Step 3: Get Available Products

```bash
curl -H "X-API-Key: your_api_key" \
  https://allendatahub.com/agent-api/products
```

You'll get back a list of products with:
- `id` (product ID to use in orders)
- `name` (e.g., "MTN 1GB")
- `price` (e.g., 2.50 GHS)
- `network` (MTN, Telecel, Vodafone, etc.)

**Copy one of the `id` values - you'll need it next**

---

## Step 4: Create Your First Order

```bash
curl -X POST https://allendatahub.com/agent-api/orders/create \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PASTE_PRODUCT_ID_HERE",
    "phoneNumber": "0541234567",
    "quantity": 1
  }'
```

Success response (you'll get):
```json
{
  "success": true,
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "status": "pending",
    "vendorOrderId": "txn_abc123",
    "phoneNumber": "0541234567",
    "totalPrice": 2.50,
    "createdAt": "2024-01-15T10:30:45.123Z"
  },
  "requestId": "req_1705330245123_abc123"
}
```

---

## Phone Number Formats (All Work!)

✅ `0541234567`  
✅ `541234567`  
✅ `+233541234567`  
✅ `233541234567`  
✅ `0541 234 567` (with spaces)  
✅ `0541-234-567` (with dashes)

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `MISSING_API_KEY` | Add header: `X-API-Key: your_key` |
| `INVALID_PHONE` | Use format like `0541234567` |
| `INSUFFICIENT_BALANCE` | Topup your wallet first |
| `PRODUCT_NOT_FOUND` | Use `id` from products endpoint |

---

## Next Steps

1. **Test more endpoints**: See [full documentation](./AGENT_API_V2_COMPLETE_GUIDE.md)
2. **Integrate into your system**: Use the examples in the full guide
3. **Track orders**: Use `GET /agent-api/orders/:orderId`
4. **Check balance**: Use `GET /agent-api/account/balance`
5. **Get support**: support@allendatahub.com

---

## Key Concepts

### Request Tracking
Every response includes `requestId`. Save these for support tickets:
```json
{
  "requestId": "req_1705330245123_abc123"
}
```

### Vendor Order ID
Store the `vendorOrderId` from order responses. This is the vendor's reference:
```json
{
  "vendorOrderId": "txn_abc123"
}
```

Use it to track the order with Portal-02 (our vendor).

---

## JavaScript Example

```javascript
const apiKey = "your_api_key_here";
const productId = "507f1f77bcf86cd799439011"; // from /products

async function createOrder(phoneNumber) {
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
    console.log("Order created:", data.order.id);
    console.log("Vendor Order ID:", data.order.vendorOrderId);
  } else {
    console.error("Order failed:", data.error, data.message);
    console.log("Support ID:", data.requestId);
  }

  return data;
}

// Use it
createOrder("0541234567");
```

---

## Python Example

```python
import requests

API_KEY = "your_api_key_here"
PRODUCT_ID = "507f1f77bcf86cd799439011"
BASE_URL = "https://allendatahub.com"

def create_order(phone_number):
    response = requests.post(
        f"{BASE_URL}/agent-api/orders/create",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "productId": PRODUCT_ID,
            "phoneNumber": phone_number,
            "quantity": 1,
        },
    )

    data = response.json()

    if response.status_code == 201:
        print(f"Order created: {data['order']['id']}")
        print(f"Vendor Order ID: {data['order']['vendorOrderId']}")
    else:
        print(f"Error: {data['error']} - {data['message']}")
        print(f"Support ID: {data['requestId']}")

    return data

# Use it
create_order("0541234567")
```

---

## All Endpoints at a Glance

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/agent-api/health` | ❌ | Check if API is online |
| POST | `/agent-api/orders/create` | ✅ | Create new order |
| GET | `/agent-api/orders/:orderId` | ✅ | Get order status |
| GET | `/agent-api/orders?page=1` | ✅ | List all your orders |
| GET | `/agent-api/products` | ✅ | Get available products |
| GET | `/agent-api/account/balance` | ✅ | Check wallet balance |

---

**Questions?** Email: support@allendatahub.com  
**Full Docs:** See [AGENT_API_V2_COMPLETE_GUIDE.md](./AGENT_API_V2_COMPLETE_GUIDE.md)
