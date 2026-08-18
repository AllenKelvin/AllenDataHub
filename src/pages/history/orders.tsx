import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  Copy,
  Database,
  Filter,
  MessageSquareWarning,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { formatCedi, formatGHS } from "@/lib/formatters";
import type { Order } from "@/lib/types";

export type OrdersHistoryNetwork = Order["network"];

export function OrdersHistoryPage({
  network,
  title = "All Orders",
  description = "Browse and filter your complete data order history.",
}: {
  network?: OrdersHistoryNetwork;
  title?: string;
  description?: string;
}) {
  const { user, updateUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState({
    search: "",
    status: "all",
    network: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
    fetch(`${apiBase}/api/orders`, {
      headers: { "x-user-id": user.id },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.orders)) setOrders(data.orders);
      })
      .catch(() => undefined);
  }, [user?.id]);

  const baseOrders = useMemo(() => {
    if (!network) return orders;
    return orders.filter((o) => o.network === network);
  }, [network, orders]);

  const filtered = useMemo(() => {
    return baseOrders.filter((order) => {
      const q = applied.search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.recipient.includes(q) ||
        order.size.toLowerCase().includes(q) ||
        order.network.toLowerCase().includes(q);

      const matchesStatus = applied.status === "all" || order.status === applied.status;
      const effectiveNetwork = network || (applied.network === "all" ? null : applied.network);
      const matchesNetwork = !effectiveNetwork || order.network === effectiveNetwork;

      return matchesSearch && matchesStatus && matchesNetwork;
    });
  }, [applied, baseOrders, network]);

  const applyFilters = () => {
    setApplied({
      search,
      status,
      network: networkFilter,
      startDate,
      endDate,
    });
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        icon={ShoppingBag}
        iconClassName="bg-violet-100 text-violet-600"
        actions={
          <Link href="/user/mtn">
            <Button className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md hover:from-blue-700 hover:to-violet-700">
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Orders"
          value={baseOrders.length}
          icon={ShoppingBag}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Recent Activity"
          value={filtered.length}
          icon={Activity}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Total Spent"
          value={formatGHS(baseOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0))}
          icon={Wallet}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Completed"
          value={baseOrders.filter((order) => order.status === "Completed").length}
          icon={Database}
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
              placeholder="Search orders, recipients…"
              className="rounded-xl pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Processing">Processing</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
              <SelectItem value="Refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          {!network && (
            <Select value={networkFilter} onValueChange={setNetworkFilter}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder="All Networks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="MTN">MTN</SelectItem>
                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                <SelectItem value="Telecel">Telecel</SelectItem>
              </SelectContent>
            </Select>
          )}
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
          <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-400">Order History</h2>
          <p className="text-sm text-slate-500">
            Showing {filtered.length} of {baseOrders.length} orders
            {applied.startDate || applied.endDate
              ? ` · dates ${applied.startDate || "…"} → ${applied.endDate || "…"}`
              : ""}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ShoppingBag}
              title="No orders found"
              description="Try adjusting your filters or place a new data order."
              action={
                <Link href="/user/mtn">
                  <Button className="rounded-xl bg-violet-600 hover:bg-violet-700">Place Order</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead>Order ID</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Bal Before</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Bal After</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium text-blue-600">{order.id}</TableCell>
                  <TableCell>{order.size}</TableCell>
                  <TableCell className="font-mono text-xs">{order.recipient}</TableCell>
                  <TableCell>{order.network}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>{order.source}</TableCell>
                  <TableCell>
                    <span
                      className={
                        order.paid
                          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                      }
                    >
                      {order.paid ? "Yes" : "No"}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500">{formatGHS(order.balBefore)}</TableCell>
                  <TableCell className="font-semibold text-slate-900 dark:text-white">
                    {formatCedi(order.amount)}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatGHS(order.balAfter)}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">{order.date}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 dark:border-slate-700 dark:bg-slate-900">
                        <DropdownMenuItem onClick={() => window.alert(`Complaint raised for ${order.id}. An admin will review it shortly.`)} className="gap-2 dark:text-slate-200">
                          <MessageSquareWarning className="h-4 w-4" />
                          Complain to admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          if (!user || !order.id) return;
                          try {
                            const response = await fetch(`${(typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000"}/api/orders/${order.id}/cancel`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-user-id": user.id },
                            });
                            const payload = await response.json().catch(() => ({}));
                            if (!response.ok) {
                              throw new Error(payload?.error || "Unable to cancel order.");
                            }
                            updateUser({ walletBalance: Number(payload.walletBalance ?? user.walletBalance) });
                            setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: "Cancelled", balAfter: Number(payload.walletBalance ?? item.balAfter) } : item));
                            window.alert(`Order ${order.id} was cancelled and ${formatGHS(Number(order.amount || 0))} was returned to your wallet.`);
                          } catch (error) {
                            window.alert(error instanceof Error ? error.message : "Unable to cancel order.");
                          }
                        }} className="gap-2 dark:text-slate-200">
                          <Trash2 className="h-4 w-4" />
                          Cancel order
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            await navigator.clipboard.writeText(order.id);
                            window.alert(`Order ID copied: ${order.id}`);
                          }}
                          className="gap-2 dark:text-slate-200"
                        >
                          <Copy className="h-4 w-4" />
                          Copy order ID
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default function AllOrdersPage() {
  return <OrdersHistoryPage />;
}
