# AllenDataHub API

The AllenDataHub API lets users and agents integrate wallet checks, package lookup, and data orders into their own applications.

## Base URL

Use the deployed backend URL supplied by your Render service:

```text
https://allen-data-hub-backend.onrender.com/api/v1
```

For local development:

```text
http://127.0.0.1:4000/api/v1
```

## 1. Generate an API key

Sign in to AllenDataHub and open **API Keys**. Enter a name and generate a key. The full key is shown once, so store it in your server secret manager.

Never expose an API key in browser JavaScript, a mobile app bundle, Git, or a public repository.

## 2. Authenticate requests

Send the key as a Bearer token:

```http
Authorization: Bearer up_live_your_key
```

The alternative header `x-api-key` is also accepted.

## 3. Check wallet balance

```bash
curl -X GET "https://allen-data-hub-backend.onrender.com/api/v1/wallet" \
  -H "Authorization: Bearer up_live_your_key"
```

Example response:

```json
{
  "ok": true,
  "walletBalance": 125.5,
  "recentDeposits": []
}
```

An administrator can override the final price for each product and account. Accounts without a saved override keep their existing standard user or agent product prices.

## 4. List packages

List every enabled package:

```bash
curl -X GET "https://allen-data-hub-backend.onrender.com/api/v1/packages" \
  -H "Authorization: Bearer up_live_your_key"
```

Filter by network:

```bash
curl -X GET "https://allen-data-hub-backend.onrender.com/api/v1/packages?network=MTN" \
  -H "Authorization: Bearer up_live_your_key"
```

Use the returned `network` and `size` values when creating an order. The returned `price` is the final price for that account and product.

## 5. Create an order

The API calculates the price from the live product catalog. Do not send a client-controlled amount.

```bash
curl -X POST "https://allen-data-hub-backend.onrender.com/api/v1/orders" \
  -H "Authorization: Bearer up_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "network": "MTN",
    "size": "3 GB",
    "recipient": "0249116309",
    "packageName": "MTN 3GB"
  }'
```

The request validates the network and package, checks the wallet balance, debits the account, creates an API-sourced order, and sends it through the configured Portal-02 vendor flow.

## 6. Get order status

```bash
curl -X GET "https://allen-data-hub-backend.onrender.com/api/v1/orders/ord_123" \
  -H "Authorization: Bearer up_live_your_key"
```

API keys can only read orders created by their own account.

## Pricing and administration

Administrators use **Admin > API** to:

- Enable or disable API access globally.
- Set the fallback API fee.
- View all user and agent API accounts.
- View each account's API keys and key status.
- Set a different final API price for every product and account.

The account-specific product price takes precedence over the global fallback fee. Products without an override use the account's role price plus the fallback API fee.

## Errors

- `401`: missing, invalid, or revoked API key.
- `403`: API access disabled, network disabled, or account not allowed.
- `404`: package or order not found.
- `422`: missing or invalid order fields.
- `400`: insufficient wallet balance or another business validation failure.
- `502`: Portal-02 could not accept the order.

Always treat a non-2xx response as a failed request and log the returned `error` without logging the API key.

## Recommended server integration

1. Store the API key in an environment variable such as `ALLENDATAHUB_API_KEY`.
2. Call `/packages` and cache the package list briefly.
3. Validate the recipient and selected package in your application.
4. Submit the order from your server, never directly from a browser.
5. Save the returned order ID.
6. Poll `/orders/{id}` or use your own scheduled reconciliation process.
7. Retry only safe GET requests unless you have an idempotency strategy for order creation.
