import { useCreateProduct, useProducts } from "@/hooks/use-products";
import { useUnverifiedAgents, useVerifyAgent } from "@/hooks/use-admin";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Loader2, ShieldAlert, CheckCircle2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import { format } from "date-fns";
import { useAgents, useCreditAgent, useAdminTotals, useAdminAllOrders } from "@/hooks/use-admin";
import { useState } from "react";

function WalletManager() {
  const { data: agents } = useAgents();
  const { mutate: credit, isPending } = useCreditAgent();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Agent</label>
          <select className="w-full p-2 border rounded" onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Select agent</option>
            {agents?.map((a: any) => (
              <option key={a._id || a.id} value={a._id || a.id}>{a.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Amount (GHS)</label>
          <input type="number" className="w-full p-2 border rounded" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
      </div>

      <div>
        <button
          className="bg-primary text-white px-4 py-2 rounded"
          disabled={!agentId || amount <= 0 || isPending}
          onClick={() => agentId && credit({ id: agentId, amount })}
        >
          Credit Wallet
        </button>
      </div>
    </div>
  );
}

function ManagePackagesTable() {
  const { data: products, isLoading } = useProducts();
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Packages</CardTitle>
        <CardDescription>Package name, agent price, regular user price, description, and gigabytes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold">Package Name</th>
                <th className="text-left py-3 px-2 font-semibold">Agent Price (GHS)</th>
                <th className="text-left py-3 px-2 font-semibold">Regular User Price (GHS)</th>
                <th className="text-left py-3 px-2 font-semibold">Package Description</th>
                <th className="text-left py-3 px-2 font-semibold">Gigabytes</th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p: any) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3 px-2">{p.name ?? '-'}</td>
                  <td className="py-3 px-2">{p.agentPrice != null ? Number(p.agentPrice).toFixed(2) : '-'}</td>
                  <td className="py-3 px-2">{p.userPrice != null ? Number(p.userPrice).toFixed(2) : '-'}</td>
                  <td className="py-3 px-2 max-w-xs truncate" title={p.description ?? ''}>{p.description ?? '-'}</td>
                  <td className="py-3 px-2">{p.dataAmount ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!products || products.length === 0) && (
            <p className="text-center py-6 text-muted-foreground">No packages yet. Add one below.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminAllOrdersTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAllOrders(page, 50);
  const orders = data?.orders ?? [];
  const totalSpent = data?.totalSpent ?? 0;
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 50, pages: 0 };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Orders</CardTitle>
        <CardDescription>All orders placed by users and agents. Time, number sent to, amount, and total.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold">Time</th>
                <th className="text-left py-3 px-2 font-semibold">Buyer</th>
                <th className="text-left py-3 px-2 font-semibold">Network</th>
                <th className="text-left py-3 px-2 font-semibold">GB</th>
                <th className="text-left py-3 px-2 font-semibold">Number sent to</th>
                <th className="text-left py-3 px-2 font-semibold">Amount (GHS)</th>
                <th className="text-left py-3 px-2 font-semibold">Payment</th>
                <th className="text-left py-3 px-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-3 px-2">{o.createdAt ? format(new Date(o.createdAt), "MMM d, h:mm a") : "-"}</td>
                  <td className="py-3 px-2">{o.buyerUsername ?? "-"} ({o.buyerRole ?? "-"})</td>
                  <td className="py-3 px-2">{o.productNetwork ?? "-"}</td>
                  <td className="py-3 px-2">{o.dataAmount ?? "-"}</td>
                  <td className="py-3 px-2">{o.phoneNumber ?? "-"}</td>
                  <td className="py-3 px-2">{o.price != null ? Number(o.price).toFixed(2) : "-"}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      o.paymentStatus === 'success' ? 'bg-green-100 text-green-700' :
                      o.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {o.paymentStatus ?? "pending"}
                    </span>
                  </td>
                  <td className="py-3 px-2">{o.status ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="text-center py-6 text-muted-foreground">No orders yet.</p>
          )}
          {orders.length > 0 && (
            <>
              <div className="mt-4 pt-4 border-t font-bold flex justify-between">
                <span>Total amount spent (this page)</span>
                <span>GHS {totalSpent.toFixed(2)}</span>
              </div>
              {pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} orders)
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TotalsPanel() {
  const { data: totals } = useAdminTotals();
  const safeTotals = {
    totalOrdersToday: (totals && typeof totals.totalOrdersToday === 'number') ? totals.totalOrdersToday : 0,
    totalGBSentToday: (totals && typeof totals.totalGBSentToday === 'number') ? totals.totalGBSentToday : 0,
    totalSpentToday: (totals && typeof totals.totalSpentToday === 'number') ? totals.totalSpentToday : 0,
    totalGBPurchased: (totals && typeof totals.totalGBPurchased === 'number') ? totals.totalGBPurchased : 0,
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-border/50">
      <h3 className="text-lg font-bold mb-2">Platform Totals</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <div className="text-sm text-muted-foreground">Orders Today (GMT)</div>
          <div className="text-xl font-bold">{safeTotals.totalOrdersToday}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <div className="text-sm text-muted-foreground">GB Sent Today</div>
          <div className="text-xl font-bold">{safeTotals.totalGBSentToday.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <div className="text-sm text-muted-foreground">GHS Spent Today</div>
          <div className="text-xl font-bold">{safeTotals.totalSpentToday}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <div className="text-sm text-muted-foreground">Total GB Purchased</div>
          <div className="text-xl font-bold">{safeTotals.totalGBPurchased.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: unverifiedAgents, isLoading: isLoadingAgents } = useUnverifiedAgents();
  const { mutate: verifyAgent, isPending: isVerifying } = useVerifyAgent();
  const { mutate: createProduct, isPending: isCreatingProduct } = useCreateProduct();

  // Create Product Form - prices with decimals, user and agent prices must differ
  const productFormSchema = insertProductSchema.extend({
    userPrice: z.coerce.number().min(0.01, "Price must be positive"),
    agentPrice: z.coerce.number().min(0.01, "Price must be positive"),
  }).refine((data) => {
    return data.userPrice !== data.agentPrice;
  }, { message: "User price and Agent price must be different", path: ["agentPrice"] });

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      network: "",
      dataAmount: "",
      price: 0,
      userPrice: undefined,
      agentPrice: undefined,
      description: "",
    },
  });

  const onSubmitProduct = (data: z.infer<typeof productFormSchema>) => {
    createProduct(data, {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground">Manage products, verify agents, and oversee platform activity.</p>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Restricted Area
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4 h-12 mb-8">
          <TabsTrigger value="agents">Agent Verification</TabsTrigger>
          <TabsTrigger value="wallet">Wallet Manager</TabsTrigger>
          <TabsTrigger value="orders">All Orders</TabsTrigger>
          <TabsTrigger value="products">Manage Packages</TabsTrigger>
        </TabsList>

        {/* AGENTS TAB */}
        <TabsContent value="agents" className="animate-in fade-in slide-in-from-left-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Agent Approvals</CardTitle>
              <CardDescription>
                Review and verify new agent registrations. Verified agents gain access to wholesale features.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAgents ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
              ) : unverifiedAgents?.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                  <p className="text-muted-foreground">No pending verifications.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unverifiedAgents?.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground font-bold">
                          {agent.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{agent.username}</p>
                          <p className="text-xs text-muted-foreground">Requested Access</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => verifyAgent(agent.id)}
                        disabled={isVerifying}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Verify Agent
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="animate-in fade-in slide-in-from-bottom-4">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Manager</CardTitle>
              <CardDescription>Manually credit GHS into an Agent's wallet.</CardDescription>
            </CardHeader>
            <CardContent>
              <WalletManager />
            </CardContent>
          </Card>
          <div className="mt-6">
            <TotalsPanel />
          </div>
        </TabsContent>

        {/* ALL ORDERS TAB - Admin sees all orders: time, number, amount, total */}
        <TabsContent value="orders" className="animate-in fade-in slide-in-from-bottom-4">
          <AdminAllOrdersTable />
        </TabsContent>

        {/* PRODUCTS TAB - Manage Packages: name, agent price, user price, description, gigabytes */}
        <TabsContent value="products" className="animate-in fade-in slide-in-from-right-4">
          <ManagePackagesTable />
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Add New Product</CardTitle>
                <CardDescription>Create a new data bundle package.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitProduct)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="network"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Network</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MTN">MTN</SelectItem>
                                <SelectItem value="Telecel">Telecel</SelectItem>
                                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="dataAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Amount (e.g. 1GB)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 1GB" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Package Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. MTN 1GB Daily" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Package Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Valid for 30 days..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="userPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Regular User Price (GHS)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" placeholder="e.g. 4.30" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="agentPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agent Price (GHS) — must differ from user price</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" placeholder="e.g. 4.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" disabled={isCreatingProduct} className="w-full">
                      {isCreatingProduct ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                      Create Product
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
