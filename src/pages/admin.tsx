import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, DollarSign, KeyRound, Shield, Users, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatGHS } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const { user, users, updateUserById } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [walletAction, setWalletAction] = useState<{ userId: string; type: "credit" | "debit"; amount: string }>({
    userId: users.find((entry) => entry.role !== "admin")?.id ?? "",
    type: "credit",
    amount: "50",
  });
  const [apiRequests, setApiRequests] = useState<Array<{ id: string; email?: string; requestType?: string; createdAt?: string; status?: string }>>([]);
  const [apiAccounts, setApiAccounts] = useState<Array<{
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
    apiPricing: Record<string, number>;
    keys: Array<{ id: string; name?: string; keyPreview?: string; status?: string; lastUsed?: string | null }>;
  }>>([]);
  const [apiProducts, setApiProducts] = useState<Array<{
    id: string;
    name: string;
    network: string;
    size: string;
    userPrice: number;
    agentPrice: number;
  }>>([]);
  const [selectedApiAccountId, setSelectedApiAccountId] = useState("");
  const [editingApiProducts, setEditingApiProducts] = useState<Set<string>>(new Set());
  const [allOrders, setAllOrders] = useState<Array<{ id: string; userId?: string; username?: string; recipient: string; network: string; size: string; amount: number; status: string; date?: string; createdAt?: string; source?: string; balBefore?: number; balAfter?: number }>>([]);
  const [disabledNetworks, setDisabledNetworks] = useState<string[]>([]);
  const [priceForm, setPriceForm] = useState({ userPrice: "4", agentPrice: "3.5", network: "MTN", label: "1GB" });
  const [apiSettings, setApiSettings] = useState({ enabled: true, note: "API access active" });
  const [summary, setSummary] = useState({ users: 0, orders: 0, refunds: 0, notifications: 0, apiKeys: 0, products: 0, networkSettings: 0, disabledNetworks: [] as string[] });

  useEffect(() => {
    const loadAdminData = async () => {
      if (!user?.id) return;
      try {
        const [overviewData, requestsData, networkData, configData, ordersData, accountsData, productsData] = await Promise.all([
          apiFetch<{ summary?: typeof summary }>('/api/admin/overview', { userId: user.id }),
          apiFetch<{ requests?: Array<{ id: string; email?: string; requestType?: string; createdAt?: string; status?: string }> }>('/api/admin/requests', { userId: user.id }),
          apiFetch<{ settings?: Array<{ network: string; enabled?: boolean }> }>('/api/network-settings', { userId: user.id }),
          apiFetch<{ config?: { enabled?: boolean; note?: string } }>('/api/admin/api-config', { userId: user.id }),
          apiFetch<{ orders?: Array<{ id: string; userId?: string; username?: string; recipient: string; network: string; size: string; amount: number; status: string; date?: string; createdAt?: string; source?: string; balBefore?: number; balAfter?: number }> }>('/api/orders', { userId: user.id }),
          apiFetch<{ accounts?: typeof apiAccounts }>('/api/admin/api-accounts', { userId: user.id }),
          apiFetch<{ products?: typeof apiProducts }>('/api/admin/api-products', { userId: user.id }),
        ]);

        setSummary(overviewData.summary || { users: 0, orders: 0, refunds: 0, notifications: 0, apiKeys: 0, products: 0, networkSettings: 0, disabledNetworks: [] });
        setApiRequests(Array.isArray(requestsData.requests) ? requestsData.requests : []);
        setAllOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
        const nextDisabled = Array.isArray(networkData?.settings)
          ? networkData.settings.filter((entry) => entry.enabled === false).map((entry) => entry.network)
          : [];
        setDisabledNetworks(nextDisabled);
        setApiSettings({
          enabled: !!configData?.config?.enabled,
          note: String(configData?.config?.note ?? "API access active"),
        });
        setApiAccounts(Array.isArray(accountsData?.accounts) ? accountsData.accounts : []);
        setApiProducts(Array.isArray(productsData?.products) ? productsData.products : []);
        if (!selectedApiAccountId && accountsData?.accounts?.[0]?.id) {
          setSelectedApiAccountId(accountsData.accounts[0].id);
        }
      } catch {
        setApiRequests([]);
        setDisabledNetworks([]);
      }
    };
    void loadAdminData();
  }, [selectedApiAccountId, user?.id]);

  const referralSummary = useMemo(() => {
    return users.map((entry) => ({
      ...entry,
      referred: users.filter((person) => person.referredBy === entry.referralCode).length,
    }));
  }, [users]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-violet-600" />
            <h2 className="mt-4 text-2xl font-bold">Admin Access Required</h2>
            <p className="mt-2 text-sm text-slate-500">You need to sign in as an administrator to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleNetworkLock = async (network: string) => {
    if (!user?.id) return;
    const next = disabledNetworks.includes(network)
      ? disabledNetworks.filter((item) => item !== network)
      : [...disabledNetworks, network];
    setDisabledNetworks(next);
    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    try {
      const response = await fetch(`${apiBase}/api/admin/network-settings/${encodeURIComponent(network)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ enabled: !next.includes(network) }),
      });
      if (!response.ok) {
        setDisabledNetworks(disabledNetworks);
      }
    } catch {
      setDisabledNetworks(disabledNetworks);
    }
  };

  const refundOrder = async (orderId: string) => {
    if (!user?.id) return;
    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId)}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(payload?.error || "Unable to refund this order.");
      return;
    }
    setAllOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: "Refunded" } : order));
    window.alert(`Refund processed for order ${orderId}.`);
  };

  const handleWalletUpdate = async () => {
    const amount = Number(walletAction.amount || 0);
    if (!walletAction.userId || !amount || Number.isNaN(amount)) return;

    const target = users.find((item) => item.id === walletAction.userId);
    if (!target) return;

    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    try {
      const response = await fetch(`${apiBase}/api/admin/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({
          userId: target.id,
          type: walletAction.type,
          amount,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(payload?.error || "Unable to update wallet balance.");
        return;
      }

      const updatedBalance = Number(payload.walletBalance ?? target.walletBalance);
      updateUserById(target.id, { walletBalance: updatedBalance });
      window.alert(`Wallet ${walletAction.type === "credit" ? "credited" : "debited"} successfully.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to update wallet balance.");
    }
  };

  const addPackage = async () => {
    if (!user?.id) return;
    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/api/admin/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        network: priceForm.network,
        label: priceForm.label,
        size: priceForm.label,
        userPrice: Number(priceForm.userPrice || 0),
        agentPrice: Number(priceForm.agentPrice || 0),
        validity: "30 Days",
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data?.error || "Unable to create package.");
      return;
    }
    setPriceForm({ userPrice: "4", agentPrice: "3.5", network: "MTN", label: "1GB" });
    window.alert("Package created successfully.");
  };

  const saveApiSettings = async () => {
    if (!user?.id) return;
    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/api/admin/api-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({ enabled: apiSettings.enabled, note: apiSettings.note }),
    });
    if (response.ok) {
      window.alert("API access settings saved.");
    }
  };

  const saveAccountProductPrice = async (accountId: string, productId: string, value: string) => {
    if (!user?.id) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return;
    try {
      const response = await fetch(`${(import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000"}/api/admin/api-accounts/${encodeURIComponent(accountId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ productId, price }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to save API price.");
      setApiAccounts((current) => current.map((account) => account.id === accountId ? {
        ...account,
        apiPricing: { ...account.apiPricing, [productId]: Number(data.price ?? price) },
      } : account));
      setEditingApiProducts((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save API price.");
    }
  };

  // Filter non-admin users for display
  const nonAdminUsers = users.filter((u) => u.role !== "admin");
  const selectedApiAccount = apiAccounts.find((account) => account.id === selectedApiAccountId);

  const getDisplayedApiPrice = (product: typeof apiProducts[number]) => {
    if (!selectedApiAccount) return product.userPrice;
    const override = selectedApiAccount.apiPricing?.[product.id];
    if (Number.isFinite(Number(override))) return Number(override);
    return selectedApiAccount.role === "agent" ? product.agentPrice : product.userPrice;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Accounts</p>
            <p className="mt-2 text-3xl font-bold">{summary.users || users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Orders</p>
            <p className="mt-2 text-3xl font-bold">{summary.orders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Referrals</p>
            <p className="mt-2 text-3xl font-bold">{users.reduce((sum, userItem) => sum + userItem.totalReferrals, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Network Locks</p>
            <p className="mt-2 text-3xl font-bold">{summary.disabledNetworks.length || disabledNetworks.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Referral overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {referralSummary.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="font-medium">{entry.fullName}</p>
                      <p className="text-xs text-slate-500">Code: {entry.referralCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Referred</p>
                      <p className="font-semibold">{entry.referred}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Set pricing & create packages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Network</Label>
                  <select value={priceForm.network} onChange={(event) => setPriceForm((current) => ({ ...current, network: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
                    <option value="MTN">MTN</option>
                    <option value="AirtelTigo">AirtelTigo</option>
                    <option value="Telecel">Telecel</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Package</Label>
                  <Input value={priceForm.label} onChange={(event) => setPriceForm((current) => ({ ...current, label: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>User Price</Label>
                  <Input value={priceForm.userPrice} onChange={(event) => setPriceForm((current) => ({ ...current, userPrice: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Agent Price</Label>
                  <Input value={priceForm.agentPrice} onChange={(event) => setPriceForm((current) => ({ ...current, agentPrice: event.target.value }))} />
                </div>
                <Button className="w-full" onClick={addPackage}>Create package</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All accounts ({nonAdminUsers.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                {nonAdminUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">No users yet.</p>
                ) : (
                  nonAdminUsers.map((entry) => (
                    <div key={entry.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{entry.fullName}</p>
                          <p className="text-xs text-slate-500">{entry.email}</p>
                        </div>
                        <Badge variant={entry.role === "agent" ? "default" : "secondary"}>{entry.role}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Wallet</span>
                        <span className="font-semibold">{formatGHS(entry.walletBalance)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Referral: {entry.referralCode}</span>
                        <span>Created: {new Date(entry.createdAt ?? Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <select
                    value={walletAction.userId}
                    onChange={(e) => setWalletAction((current) => ({ ...current, userId: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                  >
                    {nonAdminUsers.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => setWalletAction((current) => ({ ...current, type: "credit" }))} variant={walletAction.type === "credit" ? "default" : "outline"}>Credit</Button>
                  <Button onClick={() => setWalletAction((current) => ({ ...current, type: "debit" }))} variant={walletAction.type === "debit" ? "default" : "outline"}>Debit</Button>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input value={walletAction.amount} onChange={(e) => setWalletAction((current) => ({ ...current, amount: e.target.value }))} />
                </div>

                <Button className="w-full" onClick={handleWalletUpdate}>Apply Wallet {walletAction.type}</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Platform orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {allOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No orders have been created yet.</p>
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Date / time</th>
                        <th className="px-3 py-2">Recipient</th>
                        <th className="px-3 py-2">Network</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Balance before</th>
                        <th className="px-3 py-2">Balance after</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allOrders.map((order) => (
                        <tr key={order.id} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-medium text-violet-600">{order.id}</td>
                          <td className="px-3 py-2">{order.username || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(order.createdAt || order.date || Date.now()).toLocaleString()}</td>
                          <td className="px-3 py-2">{order.recipient}</td>
                          <td className="px-3 py-2">{order.network}</td>
                          <td className="px-3 py-2">{formatGHS(order.amount)}</td>
                          <td className="px-3 py-2">{formatGHS(order.balBefore ?? 0)}</td>
                          <td className="px-3 py-2">{formatGHS(order.balAfter ?? 0)}</td>
                          <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">{order.status}</span></td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant={order.status === "Cancelled" || order.status === "Refunded" ? "secondary" : "destructive"}
                              onClick={() => refundOrder(order.id)}
                              disabled={order.status === "Cancelled" || order.status === "Refunded"}
                            >
                              {order.status === "Cancelled" || order.status === "Refunded" ? "Refunded" : "Refund"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Network controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {['MTN', 'AirtelTigo', 'Telecel'].map((network) => (
                <div key={network} className="flex items-center justify-between rounded-xl border p-3">
                  <span className="font-medium">{network}</span>
                  <Button
                    variant={disabledNetworks.includes(network) ? "destructive" : "outline"}
                    onClick={() => toggleNetworkLock(network)}
                  >
                    {disabledNetworks.includes(network) ? "Disabled" : "Enabled"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API access & pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label>API access</Label>
                  <select
                    value={apiSettings.enabled ? "enabled" : "disabled"}
                    onChange={(event) => setApiSettings((current) => ({ ...current, enabled: event.target.value === "enabled" }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Status note</Label>
                  <Input
                    value={apiSettings.note}
                    onChange={(event) => setApiSettings((current) => ({ ...current, note: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <Button onClick={saveApiSettings}>Save API settings</Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API requests</h3>
                <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
                  {apiRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">No API requests yet.</p>
                  ) : (
                    apiRequests.slice(0, 20).map((request) => (
                      <div key={request.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{request.requestType || "API request"}</p>
                          <p className="text-xs text-slate-500">{request.email || request.id}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          {request.status || "Pending"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API accounts and product pricing</h3>
                  <p className="mt-1 text-xs text-slate-500">Select an account and set the final API price for every MTN, Telecel, and AirtelTigo product.</p>
                </div>
                <div className="border-b border-slate-200 bg-slate-50 p-4">
                  <Label htmlFor="api-account">Account</Label>
                  <select
                    id="api-account"
                    value={selectedApiAccountId}
                    onChange={(event) => setSelectedApiAccountId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                  >
                    {apiAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.fullName || account.id} ({account.role || "user"})
                      </option>
                    ))}
                  </select>
                  {selectedApiAccount && (
                    <p className="mt-2 text-xs text-slate-500">
                      {selectedApiAccount.email || selectedApiAccount.id} · {selectedApiAccount.keys.length} API key(s)
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Network</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Standard price</th>
                        <th className="px-4 py-3">Account API price</th>
                        <th className="px-4 py-3">Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiProducts.map((product) => (
                        <tr key={product.id} className="border-t border-slate-100 bg-white">
                          <td className="px-4 py-3 font-medium">{product.network}</td>
                          <td className="px-4 py-3">{product.name} · {product.size}</td>
                          <td className="px-4 py-3 text-slate-500">GHS {selectedApiAccount?.role === "agent" ? product.agentPrice.toFixed(2) : product.userPrice.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Input
                              aria-label={`${product.name} API price`}
                              value={String(getDisplayedApiPrice(product))}
                              disabled={!editingApiProducts.has(product.id)}
                              min="0"
                              step="0.01"
                              type="number"
                              className="h-9 w-32 rounded-lg"
                              onChange={(event) => {
                                const nextPrice = Number(event.target.value || 0);
                                setApiAccounts((current) => current.map((account) => account.id === selectedApiAccountId ? {
                                  ...account,
                                  apiPricing: { ...account.apiPricing, [product.id]: nextPrice },
                                } : account));
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              className="rounded-lg"
                              disabled={!selectedApiAccount}
                              onClick={() => {
                                if (!editingApiProducts.has(product.id)) {
                                  setEditingApiProducts((current) => new Set(current).add(product.id));
                                  return;
                                }
                                void saveAccountProductPrice(selectedApiAccountId, product.id, String(getDisplayedApiPrice(product)));
                              }}
                            >
                              {editingApiProducts.has(product.id) ? "Save" : "Edit"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {apiAccounts.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">No user or agent API accounts found.</p>}
                {apiAccounts.length > 0 && apiProducts.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">No products found.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
