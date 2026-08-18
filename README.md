# User Panel

Full-stack style dealer portal for a telecom data & utility reseller service (Portal 02 / User Panel).

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
