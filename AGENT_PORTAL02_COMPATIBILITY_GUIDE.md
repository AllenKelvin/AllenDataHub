# AllenDataHub Agent Integration — Portal02-Compatible Status Sync

This guide explains how an agent should implement order status sync so AllenDataHub webhook updates behave like Portal02.

## What changed

AllenDataHub now forwards webhook updates to the provided `webhookUrl` for these normalized internal states:

- `processing`
- `completed`
- `failed`

The callback payload now includes a `reference` field in addition to:

- `orderId` — local AllenDataHub order ID
- `vendorOrderId` — external vendor order reference
- `clientOrderReference` — agent-supplied order reference
- `reference` — alias for the incoming order reference
- `status` — normalized status (`processing`, `completed`, `failed`)
- `vendorStatus` — raw external vendor status

## Agent implementation requirements

1. Create orders using AllenDataHub API:

```http
POST /api/v1/data/purchase
Content-Type: application/json
x-api-key: <AGENT_API_KEY>

{
  "phoneNumber": "0241234567",
  "network": "MTN",
  "volume": 1,
  "webhookUrl": "https://agent.example.com/api/webhooks/allendatahub"
}
```

2. Save the returned `orderId` and/or `reference` from the purchase response.

3. Implement the webhook receiver to accept `POST` JSON and respond with HTTP `200` immediately.

4. Match incoming webhook callbacks using any available identifier:

- `clientOrderReference`
- `vendorOrderId`
- `reference`
- `orderId`

If your order data store does not know the internal AllenDataHub `orderId`, use `clientOrderReference` or `vendorOrderId`.

## Example webhook payload

```json
{
  "orderId": "65123456789abcdef0123456",
  "vendorOrderId": "external-12345",
  "clientOrderReference": "API-agentid-1685000000000-abcdef",
  "reference": "API-agentid-1685000000000-abcdef",
  "status": "completed",
  "vendorStatus": "delivered",
  "phoneNumber": "0241234567",
  "dataAmount": "1 GB",
  "webhookEvent": "order.status.updated",
  "timestamp": "2026-05-26T12:00:00.000Z",
  "raw": {
    "event": "order.status.updated",
    "orderId": "external-12345",
    "status": "delivered",
    "timestamp": "2026-05-26T12:00:00.000Z"
  }
}
```

## Example receiver (Node.js / Express)

```js
const express = require("express");
const app = express();
app.use(express.json());

app.post("/api/webhooks/allendatahub", async (req, res) => {
  const payload = req.body;

  res.status(200).json({ received: true });

  const {
    orderId,
    vendorOrderId,
    clientOrderReference,
    reference,
    status,
    vendorStatus,
    phoneNumber,
    dataAmount,
    webhookEvent,
    timestamp,
    raw,
  } = payload;

  const localOrder = await findOrder({
    clientOrderReference,
    vendorOrderId,
    reference,
    orderId,
  });

  if (!localOrder) {
    console.warn("AllenDataHub webhook could not match order", payload);
    return;
  }

  await updateOrder(localOrder.id, {
    status,
    externalStatus: vendorStatus,
    lastUpdateAt: new Date(timestamp),
    rawWebhook: raw,
  });

  // Notify customer, reconcile payment, etc.
});

app.listen(3000);
```

## Matching logic

Use fallback resolution in this order:

1. `clientOrderReference`
2. `vendorOrderId`
3. `reference`
4. `orderId`

This makes the callback compatible with Portal02-style integrations while still supporting AllenDataHub internal IDs.

## Important behavior

- AllenDataHub now forwards `processing` updates as well as final `completed`/`failed` updates.
- `vendorStatus` is the raw vendor status, while `status` is normalized for your system.

## Troubleshooting

- If your webhook returns a non-200 response, AllenDataHub will still consider the callback delivered, but your system may not update.
- Check that your endpoint is publicly reachable over HTTPS.
- Verify the `webhookUrl` provided in the purchase request matches your endpoint exactly.
- Confirm the agent request response included `orderId` and `reference`.

## Summary

To sync order status with AllenDataHub like Portal02:

- accept webhook updates at the provided `webhookUrl`
- match orders by `clientOrderReference`, `vendorOrderId`, `reference`, or `orderId`
- update local status using the normalized `status`
- support `processing`, `completed`, and `failed` events
