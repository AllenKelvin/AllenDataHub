import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Search,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState, MetricCard, PageHeader, StatusBadge } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCedi, formatGHS } from "@/lib/formatters";
import type { Refund } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function RefundsHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
    fetch(`${apiBase}/api/refunds`, {
      headers: { "x-user-id": user.id },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.refunds)) setRefunds(data.refunds);
      })
      .catch(() => undefined);
  }, [tick, user?.id]);

  useEffect(() => {
    const refreshHandler = () => setTick((current) => current + 1);
    window.addEventListener("datahub:refresh", refreshHandler);
    return () => window.removeEventListener("datahub:refresh", refreshHandler);
  }, []);

  const filtered = useMemo(() => {
    void tick;
    return refunds.filter((refund) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        refund.orderId.toLowerCase().includes(q) ||
        refund.recipient.includes(q) ||
        refund.bundle.toLowerCase().includes(q) ||
        refund.id.toLowerCase().includes(q);
      const matchesStatus = status === "all" || refund.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [search, status, tick]);

  const refresh = () => {
    setTick((t) => t + 1);
    toast({ title: "Refreshed", description: "Refund history updated." });
  };

  return (
    <div>
      <PageHeader
        title="Refunds"
        description="Track wallet refunds issued against failed or reversed orders."
        icon={RotateCcw}
        iconClassName="bg-rose-100 text-rose-600"
        actions={
          <Button variant="outline" className="gap-2 rounded-xl" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Refunds"
          value={refunds.length}
          icon={RotateCcw}
          iconClassName="bg-rose-50 text-rose-600"
        />
        <MetricCard
          label="Recent"
          value={refunds.slice(0, 5).length}
          icon={Search}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Total Refunded"
          value={formatGHS(refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0))}
          icon={Wallet}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Completed"
          value={refunds.filter((refund) => refund.status === "Refunded").length}
          icon={CheckCircle2}
          iconClassName="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order, recipient…"
            className="rounded-xl pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-400">Refund History</h2>
          <p className="text-sm text-slate-500">
            Showing {filtered.length} refund{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={RotateCcw}
              title="No refunds found"
              description="Refunds will appear here when orders are reversed to your wallet."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead>Order ID</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Bundle</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bal Before</TableHead>
                <TableHead>Bal After</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell className="font-medium text-blue-600">{refund.orderId}</TableCell>
                  <TableCell className="font-mono text-xs">{refund.recipient}</TableCell>
                  <TableCell>{refund.bundle}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">
                    {formatCedi(refund.amount)}
                  </TableCell>
                  <TableCell>{refund.method}</TableCell>
                  <TableCell>
                    <StatusBadge status={refund.status} />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatGHS(refund.balBefore)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {formatGHS(refund.balAfter)}
                    </span>
                  </TableCell>
                  <TableCell>{refund.source}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">{refund.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
