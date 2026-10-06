import { AlertTriangle, BookOpen, Copy, KeyRound, Package2, ReceiptText, ShieldCheck, ShoppingCart, Terminal, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = "https://allendatahub.onrender.com/api/v1";

const DOC_SECTIONS = [
  {
    title: "1. Generate an API key",
    icon: KeyRound,
    description: "Create a key from the API Keys section in your account and keep it in a secure server-side environment variable.",
    bullets: [
      "Sign in and open API Keys.",
      "Create a unique key for each integration.",
      "Never expose the key in public JavaScript or a frontend bundle.",
    ],
  },
  {
    title: "2. Authenticate requests",
    icon: ShieldCheck,
    description: "Send the key as a Bearer token for every request to the backend.",
    code: `curl -X GET "${API_BASE_URL}/wallet" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    title: "3. Check wallet balance",
    icon: Wallet,
    description: "Use the wallet endpoint to confirm the account balance before processing live orders.",
    code: `curl -X GET "${API_BASE_URL}/wallet" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    title: "4. List available packages",
    icon: Package2,
    description: "Pull the live product catalog and filter by network so your website can show valid bundles to customers.",
    code: `curl -X GET "${API_BASE_URL}/packages?network=MTN" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    title: "5. Create an order",
    icon: ShoppingCart,
    description: "Submit a bundle order from your server using the selected network, package size, and recipient number.",
    code: `curl -X POST "${API_BASE_URL}/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "size": "3 GB",
    "recipient": "0592786175",
    "packageName": "MTN 3GB"
  }'`,
  },
  {
    title: "6. Check order status",
    icon: ReceiptText,
    description: "Store the returned order ID and query its status to confirm delivery or failures before notifying the user.",
    code: `curl -X GET "${API_BASE_URL}/orders/ord_123" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    title: "7. Pricing and admin controls",
    icon: AlertTriangle,
    description: "Administrators can set account-specific pricing and API fallback rules. The final returned package price is what your app should charge or display.",
    bullets: [
      "Account override pricing takes precedence.",
      "Products without a custom override use the standard role pricing plus the fallback fee.",
      "Always display the final price returned by the package endpoint.",
    ],
  },
];

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/wallet",
    description: "Fetch the authenticated dealer wallet balance and recent activity.",
    example: `curl -X GET "${API_BASE_URL}/wallet" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    method: "POST",
    path: "/api/v1/orders",
    description: "Place a data bundle order for a recipient number.",
    example: `curl -X POST "${API_BASE_URL}/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "size": "3 GB",
    "recipient": "0592786175",
    "packageName": "MTN 3GB"
  }'`,
  },
  {
    method: "GET",
    path: "/api/v1/orders/{id}",
    description: "Retrieve status for a single order by ID.",
    example: `curl -X GET "${API_BASE_URL}/orders/ORD-3317560" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    method: "GET",
    path: "/api/v1/packages",
    description: "List available packages filtered by network.",
    example: `curl -X GET "${API_BASE_URL}/packages?network=MTN" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

const methodTone: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-rose-100 text-rose-700",
};

export default function ApiDocsPage() {
  const { toast } = useToast();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Example copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the snippet manually.", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="API Documentation"
        description="Integrate data purchases into your apps with the dealership REST API."
        icon={BookOpen}
        iconClassName="bg-blue-100 text-blue-600"
      />

      <div className="mb-6 rounded-2xl border border-slate-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-violet-700 dark:text-violet-300">Base URL</h2>
            <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-100">{API_BASE_URL}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Authenticate with a key from API Keys. Package prices use account-specific product pricing configured by an administrator.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="overview" className="rounded-lg">
            Overview
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="rounded-lg">
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="errors" className="rounded-lg">
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {DOC_SECTIONS.map(({ title, description, icon: Icon, bullets, code }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>

              {bullets ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {code ? (
                <div className="relative mt-4 rounded-xl bg-slate-950 p-4 text-slate-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 h-8 gap-1 rounded-lg"
                    onClick={() => copy(code)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <pre className="overflow-x-auto pr-20 text-xs leading-relaxed">{code}</pre>
                </div>
              ) : null}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {ENDPOINTS.map((ep) => (
            <div
              key={ep.path + ep.method}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <Badge className={methodTone[ep.method]}>{ep.method}</Badge>
                <code className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ep.path}</code>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm text-slate-600">{ep.description}</p>
                <div className="relative rounded-xl bg-slate-950 p-4 text-slate-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 h-8 gap-1 rounded-lg"
                    onClick={() => copy(ep.example)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <pre className="overflow-x-auto pr-20 text-xs leading-relaxed">{ep.example}</pre>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="errors">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-violet-700">Common status codes</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                <span className="font-mono font-semibold text-slate-800">401</span> — Missing or invalid API key
              </li>
              <li>
                <span className="font-mono font-semibold text-slate-800">400</span> — Insufficient wallet balance or business validation failure
              </li>
              <li>
                <span className="font-mono font-semibold text-slate-800">422</span> — Validation error on payload
              </li>
              <li>
                <span className="font-mono font-semibold text-slate-800">429</span> — Rate limit exceeded
              </li>
              <li>
                <span className="font-mono font-semibold text-slate-800">502</span> — Upstream vendor rejected the request
              </li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
