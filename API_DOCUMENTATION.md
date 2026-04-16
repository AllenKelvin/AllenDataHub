# AllenDataHub API Documentation

Welcome to the AllenDataHub API. This documentation provides comprehensive information for partners and developers looking to integrate with our data services platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Format](#requestresponse-format)
6. [Error Handling](#error-handling)
7. [Common Use Cases](#common-use-cases)
8. [Webhooks](#webhooks)
9. [Rate Limits](#rate-limits)
10. [Best Practices](#best-practices)
11. [Support & Contact](#support--contact)

---

## Getting Started

### Prerequisites

- An active AllenDataHub agent account
- API access approval from AllenDataHub admin
- An issued API key

### API Key Registration

To get started with the API:

1. **Create an Agent Account** - Register as an agent on the AllenDataHub platform
2. **Complete Verification** - Verify your account through the verification process
3. **Request API Access** - Submit an API access request through your dashboard
4. **Await Approval** - Wait for admin approval (usually within 24 hours)
5. **Receive API Key** - Once approved, your API key will be issued (store it securely)

**Important:** Treat your API key like a password. Never share it or commit it to version control.

---

## Authentication

All API requests require authentication via the `X-API-Key` header.

### Header Format

```
X-API-Key: adh_<your_secret_key>
```

### Example

```bash
curl -X GET https://api.allendatahub.com/api/v1/products \
  -H "X-API-Key: adh_your_secret_key_here"
```

### Authentication Errors

- **401 Unauthorized** - Missing or invalid API key
- **403 Forbidden** - Account not verified or API access revoked

---

## Base URL

```
https://api.allendatahub.com
```

For development/testing environments, a staging URL may be provided during onboarding.

---

## API Endpoints

### 1. List Products

Retrieve all available data products with their pricing for your account.

**Endpoint:**
```
GET /api/v1/products
```

**Headers:**
```
X-API-Key: adh_your_secret_key
```

**Query Parameters:**
None

**Response (200 OK):**
```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "MTN 1GB Data Bundle",
      "network": "MTN",
      "dataAmount": "1",
      "description": "1GB data bundle for MTN network (valid 30 days)",
      "apiPrice": 2.50
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Telecel 5GB Data Bundle",
      "network": "Telecel",
      "dataAmount": "5",
      "description": "5GB data bundle for Telecel network (valid 30 days)",
      "apiPrice": 8.75
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "AirtelTigo 2GB Data Bundle",
      "network": "AirtelTigo",
      "dataAmount": "2",
      "description": "2GB data bundle for AirtelTigo network (valid 30 days)",
      "apiPrice": 4.20
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://api.allendatahub.com/api/v1/products \
  -H "X-API-Key: adh_your_secret_key"
```

---

### 2. Create Order

Purchase a data bundle for a customer's phone number.

**Endpoint:**
```
POST /api/v1/orders
```

**Headers:**
```
X-API-Key: adh_your_secret_key
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "phoneNumber": "0541234567"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | Yes | MongoDB ID of the product (24-character hex string, from products endpoint) |
| `phoneNumber` | string | Yes | Customer's phone number (10-digit Ghanaian format) |

**Phone Number Format:**
The API accepts phone numbers in multiple formats and automatically normalizes them to 10-digit format:

| Format | Example | Accepted | Result |
|--------|---------|----------|--------|
| Local with leading 0 | `0541234567` | ✅ Yes | `0541234567` |
| Without leading 0 | `541234567` | ✅ Yes | `0541234567` |
| International with + | `+233541234567` | ✅ Yes | `0541234567` |
| International without + | `233541234567` | ✅ Yes | `0541234567` |
| With spaces | `0541 234 567` | ✅ Yes | `0541234567` |
| With dashes | `0541-234-567` | ✅ Yes | `0541234567` |

✨ **The API automatically normalizes all these formats to `0XXXXXXXXX` before processing.**

**Response (201 Created):**
```json
{
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "status": "pending",
    "paymentStatus": "success",
    "orderSource": "api",
    "phoneNumber": "0541234567",
    "price": 2.50,
    "vendorOrderId": "txn_1234567890",
    "clientOrderReference": "ORD-65a4c2e8f123456789abcdef-1705330245123",
    "productName": "MTN 1GB Data Bundle",
    "productNetwork": "MTN",
    "dataAmount": "1",
    "createdAt": "2024-01-15T10:30:45.123Z",
    "updatedAt": "2024-01-15T10:30:50.456Z",
    "walletBalanceBefore": 50.00,
    "walletBalanceAfter": 47.50
  },
  "requestId": "req_1234567890_abc123"
}
```

**Important Fields for Partners:**
- `vendorOrderId`: Use this to track the order with the vendor and match webhooks
- `clientOrderReference`: Reference sent to vendor (echoed in their webhooks)
- `status`: Order processing status

**Response Headers:**
- `X-Request-ID` - Unique identifier for this request (useful for debugging)

**Example Request:**
```bash
# Example 1: Local format
curl -X POST https://api.allendatahub.com/api/v1/orders \
  -H "X-API-Key: adh_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "phoneNumber": "0541234567"
  }'

# Example 2: International format (automatically normalized)
curl -X POST https://api.allendatahub.com/api/v1/orders \
  -H "X-API-Key: adh_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "phoneNumber": "+233541234567"
  }'

# Example 3: With spaces (automatically normalized)
curl -X POST https://api.allendatahub.com/api/v1/orders \
  -H "X-API-Key: adh_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "phoneNumber": "0541 234 567"
  }'
```

**Error Responses:**

Invalid phone number format:
```json
{
  "error": "INVALID_PHONE_NUMBER",
  "message": "Invalid phone format. Expected format: 0XXXXXXXXX (10 digits). Examples: \"0541234567\", \"+233541234567\", \"541234567\". Received: \"+233541234\"",
  "requestId": "req_1234567890_abc123"
}
```

Invalid product ID:
```json
{
  "error": "INVALID_PRODUCT_ID",
  "message": "productId must be a valid 24-character MongoDB ObjectId",
  "example": "507f1f77bcf86cd799439011",
  "received": "invalid",
  "requestId": "req_1234567890_abc123"
}
```

Product not found:
```json
{
  "error": "PRODUCT_NOT_FOUND",
  "message": "Product not found",
  "productId": "507f1f77bcf86cd799439011",
  "requestId": "req_1234567890_abc123"
}
```

Insufficient wallet balance:
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient wallet balance",
  "required": 2.50,
  "available": 1.00,
  "shortfall": 1.50,
  "suggestion": "Please topup your wallet before placing this order",
  "requestId": "req_1234567890_abc123"
}
```

---

### 3. List Orders

Retrieve all orders associated with your account with pagination support.

**Endpoint:**
```
GET /api/v1/orders
```

**Headers:**
```
X-API-Key: adh_your_secret_key
```

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number for pagination |
| `limit` | integer | 20 | 50 | Number of orders per page |
| `source` | string | "api" | - | Filter by source: "api", "web", or "all" |

**Response (200 OK):**
```json
{
  "orders": [
    {
      "id": "65a4c2e8f123456789abcdef",
      "status": "completed",
      "paymentStatus": "success",
      "orderSource": "api",
      "phoneNumber": "0541234567",
      "price": 2.50,
      "productName": "MTN 1GB Data Bundle",
      "productNetwork": "MTN",
      "dataAmount": "1",
      "createdAt": "2024-01-15T10:30:45.123Z",
      "updatedAt": "2024-01-15T10:35:12.789Z",
      "lastStatusUpdateAt": "2024-01-15T10:35:12.789Z",
      "lastVendorWebhook": {
        "vendorStatus": "delivered",
        "at": "2024-01-15T10:34:55.000Z"
      }
    },
    {
      "id": "65a4c2e9f123456789abcde0",
      "status": "failed",
      "paymentStatus": "success",
      "orderSource": "api",
      "phoneNumber": "0541234568",
      "price": 8.75,
      "productName": "Telecel 5GB Data Bundle",
      "productNetwork": "Telecel",
      "dataAmount": "5",
      "createdAt": "2024-01-14T14:20:30.456Z",
      "updatedAt": "2024-01-14T14:21:45.123Z",
      "lastStatusUpdateAt": "2024-01-14T14:21:45.123Z",
      "lastVendorWebhook": {
        "vendorStatus": "failed",
        "at": "2024-01-14T14:21:30.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "completedCount": 145
}
```

**Example Requests:**
```bash
# Get first page with default limit
curl -X GET https://api.allendatahub.com/api/v1/orders \
  -H "X-API-Key: adh_your_secret_key"

# Get second page with 50 items
curl -X GET "https://api.allendatahub.com/api/v1/orders?page=2&limit=50" \
  -H "X-API-Key: adh_your_secret_key"

# Get only API orders
curl -X GET "https://api.allendatahub.com/api/v1/orders?source=api" \
  -H "X-API-Key: adh_your_secret_key"

# Get all orders (both API and web)
curl -X GET "https://api.allendatahub.com/api/v1/orders?source=all" \
  -H "X-API-Key: adh_your_secret_key"
```

---

### 4. Get Order Details

Retrieve detailed information about a specific order.

**Endpoint:**
```
GET /api/v1/orders/:orderId
```

**Headers:**
```
X-API-Key: adh_your_secret_key
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | Yes | MongoDB ID of the order |

**Response (200 OK):**
```json
{
  "order": {
    "id": "65a4c2e8f123456789abcdef",
    "status": "processing",
    "paymentStatus": "success",
    "orderSource": "api",
    "phoneNumber": "0541234567",
    "price": 2.50,
    "productName": "MTN 1GB Data Bundle",
    "productNetwork": "MTN",
    "dataAmount": "1",
    "createdAt": "2024-01-15T10:30:45.123Z",
    "updatedAt": "2024-01-15T10:31:02.456Z",
    "lastStatusUpdateAt": "2024-01-15T10:30:50.789Z",
    "lastVendorWebhook": {
      "vendorStatus": "processing",
      "at": "2024-01-15T10:30:50.000Z"
    },
    "webhookHistory": [
      {
        "status": "processing",
        "timestamp": "2024-01-15T10:30:50.000Z",
        "message": "Order sent to vendor"
      },
      {
        "status": "confirmed",
        "timestamp": "2024-01-15T10:31:00.000Z",
        "message": "Vendor confirmed order"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET https://api.allendatahub.com/api/v1/orders/65a4c2e8f123456789abcdef \
  -H "X-API-Key: adh_your_secret_key"
```

**Error Responses:**
```json
{
  "message": "Order not found"
}
```

```json
{
  "message": "Forbidden"
}
```

---

## Request/Response Format

### Content Type

All requests and responses use `application/json` content type.

### Request Headers (Required)

```
X-API-Key: adh_your_secret_key
Content-Type: application/json
```

### HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Account not verified or access denied |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error (try again later) |

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "requestId": "req_1234567890_abc123",
  "field": "optional_field_name",
  "details": {},
  "suggestion": "optional_suggestion_for_fix"
}
```

**Note:** Every error response includes an `X-Request-ID` HTTP header for logging and support purposes.

### HTTP Status Codes

| Status | Description | Typical Cause |
|--------|-------------|---------------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST request (order created) |
| 400 | Bad Request | Invalid input data or insufficient balance |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Account not verified or API access revoked |
| 404 | Not Found | Product or order not found |
| 500 | Internal Server Error | Server-side error |

### Error Codes Reference

**Authentication Errors:**

| Code | Message | Solution |
|------|---------|----------|
| `INVALID_REQUEST` | Invalid request body | Check your JSON payload syntax and required fields |
| (401) None | Missing X-API-Key header | Add `X-API-Key: adh_your_key` to request headers |
| (401) None | Invalid API key | Verify your API key is correct and starts with `adh_` |

**Validation Errors:**

| Code | Message | Solution |
|------|---------|----------|
| `INVALID_PHONE_NUMBER` | Invalid phone format | Use format `0XXXXXXXXX` or international format `+233XXXXXXXXX` |
| `INVALID_PRODUCT_ID` | productId must be a valid ObjectId | Verify productId is a 24-character hex string from products endpoint |
| `INVALID_REQUEST` | Invalid body structure | Check all required fields are present and correctly formatted |

**Business Logic Errors:**

| Code | Message | Solution |
|------|---------|----------|
| `PRODUCT_NOT_FOUND` | Product not found | Verify productId from `/api/v1/products` endpoint |
| `INSUFFICIENT_BALANCE` | Insufficient wallet balance | Topup your wallet before placing this order |
| `NO_VALID_PRICE` | No valid API price configured | Contact support; pricing not set for your account on this product |

**System Errors:**

| Code | Message | Solution |
|------|---------|----------|
| `INTERNAL_SERVER_ERROR` | Failed to process request | Retry with exponential backoff; contact support if persists |

### Example Error Responses

**Invalid Phone Number:**
```json
{
  "error": "INVALID_PHONE_NUMBER",
  "message": "Invalid phone format. Expected format: 0XXXXXXXXX (10 digits). Examples: \"0541234567\", \"+233541234567\", \"541234567\". Received: \"invalid\"",
  "requestId": "req_1234567890_abc123"
}
```

**Insufficient Balance:**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient wallet balance",
  "required": 2.50,
  "available": 1.00,
  "shortfall": 1.50,
  "suggestion": "Please topup your wallet before placing this order",
  "requestId": "req_1234567890_abc123"
}
```

**Invalid API Key (Authentication):**
```json
{
  "message": "Invalid API key",
  "requestId": "req_1234567890_abc123"
}
```

**Account Not Verified (Authorization):**
```json
{
  "message": "API access denied",
  "requestId": "req_1234567890_abc123"
}
```

### Best Practices for Error Handling

1. **Always check the status code** before processing the response
2. **Store the requestId** from error responses for support debugging
3. **Implement exponential backoff** for 5xx errors (wait 1s, 2s, 4s before retry)
4. **Log errors** with requestId for troubleshooting
5. **Validate input** before sending requests (especially phone numbers)
6. **Handle network timeouts** gracefully (5-10 second timeout recommended)
7. **Monitor error rates** to catch integration issues early

Example error handling in TypeScript:
```typescript
async function createOrder(productId: string, phoneNumber: string) {
  try {
    const response = await fetch('https://api.allendatahub.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.ALLENDATAHUB_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, phoneNumber }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Log with requestId for support
      console.error(`Order failed [${data.requestId}]: ${data.error} - ${data.message}`);
      
      // Handle specific errors
      if (data.error === 'INSUFFICIENT_BALANCE') {
        console.log(`Need GHS ${data.shortfall} more`);
      } else if (data.error === 'INVALID_PHONE_NUMBER') {
        console.log(`Phone format: use 0XXXXXXXXX format`);
      }
      
      throw new Error(data.message);
    }

    return data.order;
  } catch (err) {
    console.error(`Network error:`, err);
    throw err;
  }
}
```

---

## Common Use Cases

### Use Case 1: Sell Data Bundles in Your Mobile App

```javascript
// 1. Get available products
const getAvailableProducts = async () => {
  const response = await fetch('https://api.allendatahub.com/api/v1/products', {
    headers: {
      'X-API-Key': 'adh_your_secret_key'
    }
  });
  return await response.json();
};

// 2. Purchase bundle when customer selects
const purchaseBundle = async (productId, phoneNumber) => {
  const response = await fetch('https://api.allendatahub.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'X-API-Key': 'adh_your_secret_key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: productId,
      phoneNumber: phoneNumber
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
};

// 3. Monitor order status
const checkOrderStatus = async (orderId) => {
  const response = await fetch(
    `https://api.allendatahub.com/api/v1/orders/${orderId}`,
    {
      headers: {
        'X-API-Key': 'adh_your_secret_key'
      }
    }
  );
  return await response.json();
};
```

### Use Case 2: Bulk Purchase Report

```python
import requests
import json
from datetime import datetime, timedelta

API_KEY = "adh_your_secret_key"
BASE_URL = "https://api.allendatahub.com"

def get_orders_report(days=7, limit=50):
    """Get all orders from the last N days"""
    all_orders = []
    page = 1
    
    while True:
        url = f"{BASE_URL}/api/v1/orders"
        params = {
            'page': page,
            'limit': limit,
            'source': 'api'
        }
        headers = {'X-API-Key': API_KEY}
        
        response = requests.get(url, params=params, headers=headers)
        data = response.json()
        
        # Filter by date
        for order in data['orders']:
            created = datetime.fromisoformat(order['createdAt'].replace('Z', '+00:00'))
            if (datetime.now(created.tzinfo) - created).days <= days:
                all_orders.append(order)
        
        # Check if there are more pages
        if page >= data['pagination']['pages']:
            break
        
        page += 1
    
    return all_orders

def generate_report(orders):
    """Generate summary report"""
    total_revenue = sum(o['price'] for o in orders)
    completed = len([o for o in orders if o['status'] == 'completed'])
    failed = len([o for o in orders if o['status'] == 'failed'])
    
    return {
        'total_orders': len(orders),
        'completed_orders': completed,
        'failed_orders': failed,
        'total_revenue': f"GHS {total_revenue:.2f}",
        'success_rate': f"{(completed / len(orders) * 100):.1f}%"
    }

# Usage
orders = get_orders_report(days=7)
report = generate_report(orders)
print(json.dumps(report, indent=2))
```

### Use Case 3: Reconciliation Check

```bash
#!/bin/bash

API_KEY="adh_your_secret_key"
BASE_URL="https://api.allendatahub.com"

# Get last 100 API orders
echo "Fetching last 100 orders..."
curl -s -X GET "${BASE_URL}/api/v1/orders?source=api&limit=100" \
  -H "X-API-Key: ${API_KEY}" | jq '.'

# Get order details for verification
ORDER_ID="65a4c2e8f123456789abcdef"
echo "Fetching order details..."
curl -s -X GET "${BASE_URL}/api/v1/orders/${ORDER_ID}" \
  -H "X-API-Key: ${API_KEY}" | jq '.order | {id, status, price, createdAt}'
```

---

## Webhooks

Webhooks notify you about real-time updates to orders. When an order status changes from the vendor, we POST an event to your registered webhook URL.

### Webhook Events

**Event: Order Status Update**

When an order's status changes, we send:

```json
{
  "event": "order.status_updated",
  "orderId": "65a4c2e8f123456789abcdef",
  "status": "completed",
  "previousStatus": "processing",
  "timestamp": "2024-01-15T10:34:55.000Z",
  "details": {
    "phoneNumber": "0541234567",
    "productNetwork": "MTN",
    "dataAmount": "1",
    "vendorStatus": "delivered"
  }
}
```

### Status Values in Webhooks

- `pending` - Order created
- `processing` - Vendor is processing
- `completed` - Successfully delivered
- `failed` - Order failed

### Implementing a Webhook Receiver

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint
app.post('/webhooks/allendatahub', (req, res) => {
  const { event, orderId, status, timestamp, details } = req.body;
  
  console.log(`Received event: ${event}`);
  console.log(`Order ${orderId} status: ${status}`);
  
  // Update your database
  if (status === 'completed') {
    // Mark order as complete in your system
    console.log(`Data delivered to ${details.phoneNumber}`);
  } else if (status === 'failed') {
    // Handle failure - refund customer, notify support, etc.
    console.log(`Order failed for ${details.phoneNumber}`);
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ message: 'Webhook received' });
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});
```

### Webhook Best Practices

1. **Respond quickly** - Acknowledge within 5 seconds
2. **Verify authenticity** - Check headers for signature (if provided)
3. **Idempotent processing** - Handle duplicate events safely
4. **Retry logic** - We retry failed webhooks 3 times with exponential backoff
5. **Log all events** - For debugging and reconciliation
6. **Test your endpoint** - Before going live

---

## Rate Limits

### Rate Limiting Rules

- **100 requests per minute** per API key
- **Headers returned:**
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 75`
  - `X-RateLimit-Reset: 1705327200`

### Rate Limit Exceeded

When you exceed the limit, you receive:

```
HTTP 429 Too Many Requests

{
  "message": "Rate limit exceeded. Retry after 60 seconds"
}
```

### Recovery Strategy

```python
import time
import requests

def make_request_with_retry(url, headers, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('X-RateLimit-Reset', 60))
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

---

## Best Practices

### 1. API Key Management

- ✅ Store API keys in environment variables
- ✅ Rotate keys regularly
- ✅ Use different keys for different environments
- ❌ Never hardcode API keys
- ❌ Never commit keys to version control
- ❌ Never share keys via email or chat

```bash
# .env file
ALLENDATAHUB_API_KEY=adh_your_secret_key
```

```javascript
const API_KEY = process.env.ALLENDATAHUB_API_KEY;
```

### 2. Error Handling

```python
import requests

def purchase_data_safely(product_id, phone_number):
    try:
        response = requests.post(
            'https://api.allendatahub.com/api/v1/orders',
            headers={'X-API-Key': API_KEY},
            json={
                'productId': product_id,
                'phoneNumber': phone_number
            },
            timeout=10  # 10 second timeout
        )
        
        if response.status_code == 201:
            return response.json()['order']
        elif response.status_code == 400:
            error = response.json()
            print(f"Validation error: {error['message']}")
        elif response.status_code == 429:
            print("Rate limited - implement exponential backoff")
        else:
            print(f"Unexpected error: {response.status_code}")
            
    except requests.Timeout:
        print("Request timed out")
    except requests.ConnectionError:
        print("Connection failed - check your internet")
```

### 3. Monitoring & Logging

```python
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api_calls.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def log_api_call(endpoint, method, status_code, response_time):
    logger.info(
        f"{method} {endpoint} - Status: {status_code} - "
        f"Time: {response_time}ms"
    )
```

### 4. Retry Logic

```javascript
async function createOrderWithRetry(
  productId, 
  phoneNumber, 
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        'https://api.allendatahub.com/api/v1/orders',
        {
          method: 'POST',
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ productId, phoneNumber })
        }
      );

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429) {
        // Rate limited - wait with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        // Server error - retry
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}
```

### 5. Data Validation

```python
import re
from typing import Tuple

def validate_phone_number(phone: str) -> Tuple[bool, str]:
    """Validate Ghanaian phone numbers"""
    # Remove common formatting
    cleaned = phone.replace('-', '').replace(' ', '').replace('+', '')
    
    # Check various formats
    patterns = [
        r'^233\d{9}$',      # +233XXXXXXXXX format
        r'^0\d{9}$',        # 0XXXXXXXXX format
        r'^\d{9}$'          # XXXXXXXXX format (9 digits)
    ]
    
    for pattern in patterns:
        if re.match(pattern, cleaned):
            return True, cleaned
    
    return False, ""

def validate_order_request(product_id: str, phone_number: str) -> Tuple[bool, str]:
    """Validate order request"""
    
    # Validate product ID (MongoDB ObjectId format)
    if not re.match(r'^[a-f0-9]{24}$', product_id):
        return False, "Invalid product ID format"
    
    # Validate phone number
    is_valid, _ = validate_phone_number(phone_number)
    if not is_valid:
        return False, "Invalid phone number format"
    
    return True, ""

# Usage
is_valid, error = validate_order_request(product_id, phone_number)
if not is_valid:
    print(f"Validation failed: {error}")
```

---

## Support & Contact

### Getting Help

- **Email Support:** support@allendatahub.com
- **Developer Portal:** https://developers.allendatahub.com
- **Status Page:** https://status.allendatahub.com
- **Documentation:** https://docs.allendatahub.com

### Frequently Asked Questions

**Q: How long does it take for data to be delivered?**
A: Most data is delivered within 2-5 minutes. You can check the status using the order details endpoint.

**Q: What if an order fails?**
A: Check the order status for failure reason. You can retry with a new order if needed.

**Q: Can I get a webhook for completion?**
A: Yes, webhooks are supported. Contact support to register your webhook URL.

**Q: What payment methods do you accept?**
A: We accept Paystack payments. Balance-based payments are available after account verification.

**Q: Is there a sandbox/test environment?**
A: Contact support for testing credentials.

**Q: How do I increase my rate limit?**
A: Contact support with your use case - we can adjust limits for verified partners.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial API release |

---

## Legal & Compliance

- **Terms of Service:** https://allendatahub.com/terms
- **Privacy Policy:** https://allendatahub.com/privacy
- **Data Processing Agreement:** Available upon request

By using the AllenDataHub API, you agree to our Terms of Service and Privacy Policy.

---

**Last Updated:** January 15, 2024  
**API Version:** v1  

For the latest updates, visit our developer portal at developers.allendatahub.com
