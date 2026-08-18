import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  Filter,
  Plus,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
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
import type { Deposit } from "@/lib/types";

export default function DepositsHistoryPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState({
    search: "",
    status: "all",
    platform: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
    fetch(`${apiBase}/api/deposits`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.deposits)) setDeposits(data.deposits);
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    return deposits.filter((deposit) => {
      const q = applied.search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        deposit.id.toLowerCase().includes(q) ||
        deposit.reference.toLowerCase().includes(q) ||
        deposit.platform.toLowerCase().includes(q);

      const matchesStatus = applied.status === "all" || deposit.status === applied.status;
      const matchesPlatform =
        applied.platform === "all" || deposit.platform.toLowerCase() === applied.platform;

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [applied, deposits]);

  const totals = useMemo(() => {
    const totalDeposits = deposits.length;
    const totalAmount = deposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);
    const avgDeposit = totalDeposits > 0 ? totalAmount / totalDeposits : 0;
    return { totalDeposits, recent: Math.min(totalDeposits, 6), totalAmount, avgDeposit };
  }, [deposits]);

  const applyFilters = () => {
    setApplied({
      search,
      status,
      platform,
      startDate,
      endDate,
    });
  };

  return (
    <div>
      <PageHeader
        title="Deposit History"
        description="Review wallet top-ups across Paystack, MoMo, and other channels."
        icon={Wallet}
        iconClassName="bg-emerald-100 text-emerald-600"
        actions={
          <Link href="/user/wallet">
            <Button className="gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700">
              <Plus className="h-4 w-4" />
              Add Funds
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Deposits"
          value={totals.totalDeposits}
          icon={Wallet}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Recent"
          value={totals.recent}
          icon={Activity}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Total Amount"
          value={formatGHS(totals.totalAmount)}
          icon={TrendingUp}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Avg Deposit"
          value={formatGHS(totals.avgDeposit)}
          icon={Filter}
          iconClassName="bg-blue-50 text-blue-600"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, ID…"
              className="rounded-xl pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Credited">Credited</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="paystack">Paystack</SelectItem>
              <SelectItem value="momo">MoMo</SelectItem>
              <SelectItem value="bulkclix">BulkClix</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px] rounded-xl"
            aria-label="Start date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px] rounded-xl"
            aria-label="End date"
          />
          <Button
            onClick={applyFilters}
            className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-400">Deposits</h2>
          <p className="text-sm text-slate-500">
            Showing {filtered.length} of {deposits.length} deposits
            {applied.startDate || applied.endDate
              ? ` · dates ${applied.startDate || "…"} → ${applied.endDate || "…"}`
              : ""}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Wallet}
              title="No deposits found"
              description="Top up your wallet to see deposit records here."
              action={
                <Link href="/user/wallet">
                  <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Add Funds</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead>Deposit ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bal Before</TableHead>
                <TableHead>Bal After</TableHead>
                <TableHead>Handled By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell className="font-medium text-blue-600">{deposit.id}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">
                    {formatCedi(deposit.amount)}
                  </TableCell>
                  <TableCell className="capitalize">{deposit.method}</TableCell>
                  <TableCell className="capitalize">{deposit.platform}</TableCell>
                  <TableCell className="font-mono text-xs">{deposit.reference}</TableCell>
                  <TableCell>
                    <StatusBadge status={deposit.status} />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatGHS(deposit.balBefore)}</TableCell>
                  <TableCell className="text-slate-500">{formatGHS(deposit.balAfter)}</TableCell>
                  <TableCell>{deposit.handledBy}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">{deposit.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
