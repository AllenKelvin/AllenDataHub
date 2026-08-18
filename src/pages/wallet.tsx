import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Eye,
  EyeOff,
  Filter,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatGHS } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

const ADMIN_FEE = 0.04;
const MIN_TOPUP = 10;

const SEND_CLAIM_ADVANTAGES = [
  "Instant wallet credit after claim",
  "No card required — send via MoMo",
  "Ideal for bulk dealer top-ups",
  "Lower fees on larger amounts",
];

const SPECIAL_PROGRAMS = [
  {
    title: "Volume Rebate",
    description: "Earn bonus credit when you top up GHS 2,000+ in a month.",
  },
  {
    title: "Partner Float",
    description: "Request float extensions for peak sales weekends.",
  },
  {
    title: "Loyalty Boost",
    description: "Extra commission on MTN packages for approved dealers.",
  },
];

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visible, setVisible] = useState(true);
  const [amount, setAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedDeposit, setSelectedDeposit] = useState<string | null>(null);

  const balance = user?.walletBalance ?? 0;
  const change = 0;
  const parsedAmount = parseFloat(amount) || 0;
  const fee = parsedAmount * ADMIN_FEE;
  const totalPay = parsedAmount + fee;

  const [deposits, setDeposits] = useState<any[]>([]);

  const userDeposits = useMemo(
    () =>
      deposits.filter((deposit) => !deposit.userId || deposit.userId === user?.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [deposits, user?.id]
  );

  useEffect(() => {
    if (!user) return;
    const loadDeposits = async () => {
      try {
        const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
        const response = await fetch(`${apiBase}/api/deposits`, {
          headers: { "x-user-id": user.id },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load deposits.");
        const nextDeposits = Array.isArray(data.deposits)
          ? data.deposits.filter((deposit: any) => !deposit.userId || deposit.userId === user.id)
          : [];
        setDeposits(nextDeposits);
      } catch {
        setDeposits([]);
      }
    };

    loadDeposits();
  }, [user]);

  const filteredDeposits = useMemo(() => {
    return userDeposits.filter((deposit) => {
      if (filter === "all") return true;
      if (filter === "credited") return deposit.status === "Credited";
      if (filter === "pending") return deposit.status === "Pending";
      return deposit.platform === filter || deposit.method === filter;
    });
  }, [userDeposits, filter]);

  const recentActivityAmount = userDeposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);
  const recentActivityCount = Math.min(userDeposits.length, 6);

  const handlePaystack = async () => {
    if (parsedAmount < MIN_TOPUP) {
      toast({
        title: "Minimum top-up",
        description: `Enter at least GHS ${MIN_TOPUP}.00`,
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in before funding your wallet.",
        variant: "destructive",
      });
      return;
    }

    setIsPaying(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
      const response = await fetch(`${apiBase}/api/payments/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ amount: parsedAmount }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to initialize Paystack payment.");
      }

      if (!data.authorizationUrl) {
        throw new Error(data?.message || "Paystack did not return a checkout URL.");
      }

      window.location.assign(data.authorizationUrl);
    } catch (error) {
      toast({
        title: "Payment initialization failed",
        description: error instanceof Error ? error.message : "Unable to open Paystack.",
        variant: "destructive",
      });
      setIsPaying(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Wallet Management"
        description="Manage your wallet balance, top up via Paystack, and review deposit history."
        icon={Wallet}
        iconClassName="bg-emerald-100 text-emerald-600"
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 p-6 text-white shadow-lg shadow-emerald-200/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Wallet Balance</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  {visible ? formatGHS(balance) : "GHS ••••••"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="rounded-xl bg-white/20 p-2.5 backdrop-blur transition hover:bg-white/30"
                aria-label={visible ? "Hide balance" : "Show balance"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" />
              {change}% from last month
            </div>
            <div className="mt-6 border-t border-white/20 pt-4 text-sm text-white/90">
              Recent activity: <span className="font-semibold">+{formatGHS(recentActivityAmount)} / {recentActivityCount} deposit{recentActivityCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-300">Recommended: Send & Claim</h2>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-300">
              Prefer Send & Claim for faster funding with fewer payment steps when available.
            </p>
            <ul className="space-y-2.5">
              {SEND_CLAIM_ADVANTAGES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-violet-700 dark:text-violet-300">Special Programs Available</h2>
            <div className="space-y-3">
              {SPECIAL_PROGRAMS.map((program) => (
                <div
                  key={program.title}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{program.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{program.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-md">
            <p className="font-semibold">Need a special program?</p>
            <p className="mt-1.5 text-sm text-violet-100">
              Contact support to enroll in volume rebates, partner float, or loyalty boosts tailored to your dealer account.
            </p>
            <a
              href="https://wa.me/233546051806"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
            >
              Contact Support
            </a>
          </div>
        </div>

        {/* Right column — Top Up */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-violet-700">Top Up Wallet</h2>
            <p className="mb-5 text-sm text-slate-500">Choose a payment method and enter your amount.</p>

            <Tabs defaultValue="paystack">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                <TabsTrigger
                  value="send-claim"
                  disabled
                  className="gap-1.5 rounded-lg data-[state=active]:bg-white"
                >
                  Send & Claim
                  <Badge variant="secondary" className="bg-slate-200 text-[10px] text-slate-600">
                    Disabled
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="paystack" className="rounded-lg data-[state=active]:bg-white">
                  Paystack
                </TabsTrigger>
                <TabsTrigger
                  value="bulkclix"
                  disabled
                  className="gap-1.5 rounded-lg data-[state=active]:bg-white"
                >
                  BulkClix
                  <Badge variant="secondary" className="bg-slate-200 text-[10px] text-slate-600">
                    Disabled
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paystack" className="mt-0 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="topup-amount" className="text-slate-700">
                      Amount (GHS)
                    </Label>
                    <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Min GHS {MIN_TOPUP}
                    </Badge>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      GHS
                    </span>
                    <Input
                      id="topup-amount"
                      type="number"
                      min={MIN_TOPUP}
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 rounded-xl pl-12 text-lg font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-600">Admin Fee</span>
                  <span className="font-bold text-orange-600">4%</span>
                </div>

                {parsedAmount >= MIN_TOPUP && (
                  <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Amount to receive</span>
                      <span className="font-semibold text-slate-800">{formatGHS(parsedAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Admin fee (4%)</span>
                      <span className="font-semibold text-orange-600">{formatGHS(fee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                      <span>Total to pay</span>
                      <span>{formatGHS(totalPay)}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handlePaystack}
                  disabled={isPaying}
                  className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white shadow-md shadow-orange-200 hover:bg-orange-600"
                >
                  {isPaying ? "Opening Paystack..." : "Proceed to Paystack"}
                </Button>

                <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Secured by SSL · Payments processed by Paystack
                </p>
              </TabsContent>

              <TabsContent value="send-claim">
                <p className="py-8 text-center text-sm text-slate-500">Send & Claim is temporarily disabled.</p>
              </TabsContent>
              <TabsContent value="bulkclix">
                <p className="py-8 text-center text-sm text-slate-500">BulkClix is temporarily disabled.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Recent Deposits */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-violet-700">Recent Deposits</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-[140px] rounded-xl">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="momo">MoMo</SelectItem>
                <SelectItem value="bulkclix">BulkClix</SelectItem>
                <SelectItem value="credited">Credited</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl">
              View All
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.map((deposit) => (
                <tr
                  key={deposit.id}
                  className="border-b border-slate-50 transition hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-800">{deposit.id}</td>
                  <td className="px-5 py-3.5 capitalize text-slate-600">
                    {deposit.platform}
                    <span className="ml-1 text-xs text-slate-400">({deposit.method})</span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-emerald-600">
                    {formatGHS(deposit.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={deposit.status} />
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{deposit.date}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeposit(deposit.id);
                        toast({
                          title: deposit.id,
                          description: `Ref ${deposit.reference} · ${formatGHS(deposit.amount)} · ${deposit.status}`,
                        });
                      }}
                      className={`rounded-lg p-1.5 transition hover:bg-slate-100 ${
                        selectedDeposit === deposit.id ? "text-violet-600" : "text-slate-400 hover:text-slate-700"
                      }`}
                      aria-label={`View ${deposit.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDeposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No deposits match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Showing {filteredDeposits.length} of {deposits.length} deposits
        </div>
      </div>
    </div>
  );
}
