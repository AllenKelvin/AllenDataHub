import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  MessageSquareWarning,
  MoreHorizontal,
  Plus,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatCedi, formatGHS, greetingForHour } from "@/lib/formatters";

const TOP_PACKAGES = [
  { name: "MTN 3GB", sales: 48, price: 12 },
  { name: "MTN 6GB", sales: 36, price: 23 },
  { name: "AT 10GB", sales: 22, price: 39 },
  { name: "Telecel 5GB", sales: 18, price: 19.8 },
];
import type { Deposit, Order } from "@/lib/types";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] || "Dealer";
  const isMobile = useIsMobile();
  const [dashboard, setDashboard] = useState({
    walletBalance: user?.walletBalance ?? 0,
    walletChange: 0,
    totalOrders: 0,
    totalOrdersChange: 0,
    pendingOrders: 0,
    pendingOrdersChange: 0,
    completedOrders: 0,
    completedOrdersChange: 0,
    recentOrders: [] as Order[],
    recentDeposits: [] as Deposit[],
  });

  useEffect(() => {
    if (!user?.id) return;

    setDashboard((prev) => ({
      ...prev,
      walletBalance: user.walletBalance ?? 0,
    }));

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
    fetch(`${apiBase}/api/orders`, {
      headers: { "x-user-id": user.id },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.orders) return;
        const userOrders = Array.isArray(data.orders) ? data.orders.filter((o: any) => o.userId === user.id || !o.userId).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
        const pendingOrders = userOrders.filter((o: any) => o.status === "Pending").length;
        const completedOrders = userOrders.filter((o: any) => o.status === "Completed").length;
        setDashboard((prev) => ({
          ...prev,
          recentOrders: userOrders.slice(0, 5),
          totalOrders: userOrders.length,
          pendingOrders,
          completedOrders,
        }));
      })
      .catch(() => undefined);

    fetch(`${apiBase}/api/deposits`, {
      headers: { "x-user-id": user.id },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!Array.isArray(data?.deposits)) return;
        setDashboard((prev) => ({
          ...prev,
          recentDeposits: data.deposits.slice(0, 5),
        }));
      })
      .catch(() => undefined);
  }, [user?.id, user?.walletBalance]);

  const recentOrders = dashboard.recentOrders.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`${greetingForHour()}, ${firstName}! 👋`}
        description="Welcome back to your dealer dashboard. Here's what's happening today."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            <Link href="/user/mtn">
              <Button className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md hover:from-blue-700 hover:to-violet-700">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <StatCard
            label="Wallet Balance"
            value={formatCedi(dashboard.walletBalance)}
            change={dashboard.walletChange}
            icon={Wallet}
            tone="green"
          />
          <Link href="/user/wallet" className="absolute right-4 top-14">
            <Button size="sm" className="h-7 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">
              Top up
            </Button>
          </Link>
        </div>
        <StatCard
          label="Total Orders"
          value={dashboard.totalOrders}
          change={dashboard.totalOrdersChange}
          icon={ShoppingCart}
          tone="purple"
        />
        <StatCard
          label="Pending Orders"
          value={dashboard.pendingOrders}
          change={dashboard.pendingOrdersChange}
          icon={Clock3}
          tone="orange"
        />
        <StatCard
          label="Completed Orders"
          value={dashboard.completedOrders}
          change={dashboard.completedOrdersChange}
          icon={CheckCircle2}
          tone="magenta"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="min-w-0 rounded-2xl border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg dark:text-slate-100">Recent Orders</CardTitle>
            <Link href="/user/history/orders">
              <Button variant="link" className="h-auto p-0 text-sm font-medium text-violet-600 dark:text-violet-300">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="overflow-hidden p-0 pb-2">
            {recentOrders.length === 0 ? (
              <p className="px-6 pb-4 text-sm text-slate-500">No recent orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead>Order ID</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-blue-600">{order.id}</TableCell>
                        <TableCell>{order.size}</TableCell>
                        <TableCell className="font-mono text-xs">{order.recipient}</TableCell>
                        <TableCell>{order.network}</TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell className="font-semibold">{formatCedi(order.amount)}</TableCell>
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
                                  if (!response.ok) throw new Error(payload?.error || "Unable to cancel order.");
                                  updateUser({ walletBalance: Number(payload.walletBalance ?? user.walletBalance) });
                                  setDashboard((current) => ({
                                    ...current,
                                    recentOrders: current.recentOrders.map((item) => item.id === order.id ? { ...item, status: "Cancelled" } : item),
                                  }));
                                  window.alert(`Order ${order.id} was cancelled and ${formatGHS(Number(order.amount || 0))} was returned to your wallet.`);
                                } catch (error) {
                                  window.alert(error instanceof Error ? error.message : "Unable to cancel order.");
                                }
                              }} className="gap-2 dark:text-slate-200">
                                <Trash2 className="h-4 w-4" />
                                Cancel order
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                await navigator.clipboard.writeText(order.id);
                                window.alert(`Order ID copied: ${order.id}`);
                              }} className="gap-2 dark:text-slate-200">
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-100 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Deposits</CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? "pb-2" : "space-y-3"}>
            {isMobile ? (
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {dashboard.recentDeposits.slice(0, 5).map((d) => (
                    <div key={d.id} className="min-w-[170px] rounded-2xl border border-slate-200 bg-emerald-50/80 p-3 dark:border-slate-700 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Deposit</p>
                        <StatusBadge status={d.status.toLowerCase()} />
                      </div>
                      <p className="mt-3 text-base font-bold text-emerald-600 dark:text-emerald-300">{formatGHS(d.amount).replace("GHS ", "GHS")}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{d.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              dashboard.recentDeposits.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"
                >
                  <div>
                    <p className="font-semibold text-emerald-600">{formatGHS(d.amount).replace("GHS ", "GHS")}</p>
                    <p className="text-xs text-slate-500">{d.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status.toLowerCase()} />
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-2xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Top Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOP_PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
              >
                <p className="font-semibold text-slate-800">{pkg.name}</p>
                <p className="mt-1 text-sm text-slate-500">{pkg.sales} sales this month</p>
                <p className="mt-3 text-lg font-bold text-violet-600">{formatGHS(pkg.price)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
