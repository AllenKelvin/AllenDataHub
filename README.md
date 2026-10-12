# User Panel

Full-stack style dealer portal for a telecom data & utility reseller service (Hubnet / User Panel).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Lucide React icons
- TanStack Query
- Wouter routing
- Recharts

## Run

```bash
cd user-panel
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

**Demo login:** any email + password (4+ characters). Prefill is already set on the sign-in form.

## Routes

| Path | Page |
|------|------|
| `/login` | Sign in |
| `/user/dashboard` | Dashboard |
| `/user/wallet` | Wallet management |
| `/user/cart` | Shopping cart |
| `/user/profile` | My profile |
| `/user/mtn` | MTN data purchase |
| `/user/airteltigo` | AirtelTigo purchase |
| `/user/telecel` | Telecel purchase |
| `/user/history/*` | Orders, refunds, deposits, etc. |
| `/user/api-docs` | API documentation |
| `/user/api-keys` | API key management |
| `/user/settings` | Preferences |

Data is mocked client-side for a complete walkthrough UI.

## Vendor configuration

The server sends data orders through Hubnet. Configure `HUBNET_API_KEY` as a server-side secret before enabling live purchases. The optional `HUBNET_BASE_URL` override defaults to `https://console.hubnet.app/live/api/context/business`.

Hubnet does not expose an order cancellation endpoint, so cancellation/refund requests are blocked until a supported vendor cancellation flow is available.

## Arkesel SMS

Configure `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID=ALLEN.APP`, and `ARKESEL_WEBHOOK_SECRET` as server-side environment variables. `ARKESEL_COUNTRY_CODE` defaults to `233` and is used to normalize Ghanaian local phone numbers. New registrations receive a 6-digit SMS verification code, valid for 15 minutes, with a one-minute resend cooldown, three messages per phone per hour, and five verification attempts. Accounts cannot log in until the code is verified. Verified users receive best-effort SMS alerts for orders, wallet credits, refunds, and referral activity.

The signed callback endpoint is `POST /api/webhooks/arkesel`. It checks Arkesel's documented `X-Webhook-Timestamp` and `X-Webhook-Signature` headers using HMAC-SHA256 over `<timestamp>.<raw request body>`, rejects timestamps more than five minutes from server time, and acknowledges valid callbacks. Configure that URL in Arkesel only for a webhook integration that uses this signature format. The published SMS send API itself does not require a webhook; its send result is checked synchronously.

Never put the Arkesel API key in client-side `VITE_*` variables or commit it to the repository.
