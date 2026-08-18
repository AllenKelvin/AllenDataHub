import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  LayoutGrid,
  List,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatGHS } from "@/lib/formatters";

const MTN_PACKAGES: DataPackage[] = [];
const AT_PACKAGES: DataPackage[] = [];
const TELECEL_PACKAGES: DataPackage[] = [];
import type { DataPackage } from "@/lib/types";
import { StatusBadge, WalletPill } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type NetworkKey = "MTN" | "AirtelTigo" | "Telecel";

const NETWORK_CONFIG: Record<
  NetworkKey,
  {
    title: string;
    subtitle: string;
    offerName: string;
    validity: string;
    packages: DataPackage[];
    accent: {
      border: string;
      ring: string;
      bgSoft: string;
      bg: string;
      text: string;
      button: string;
      badge: string;
      selectedPkg: string;
    };
  }
> = {
  MTN: {
    title: "MTN Data Bundle",
    subtitle: "Purchase MTN data packages instantly for yourself or your customers.",
    offerName: "Master Beneficiary Data Bundle",
    validity: "90 Days",
    packages: MTN_PACKAGES,
    accent: {
      border: "border-amber-400",
      ring: "ring-amber-400/40",
      bgSoft: "bg-amber-50",
      bg: "bg-amber-400",
      text: "text-amber-800",
      button: "bg-amber-500 hover:bg-amber-600 text-white",
      badge: "bg-amber-500 text-white",
      selectedPkg: "border-amber-400 bg-amber-50 ring-2 ring-amber-400/30",
    },
  },
  AirtelTigo: {
    title: "AirtelTigo Data Bundle",
    subtitle: "Purchase AirtelTigo data packages instantly for yourself or your customers.",
    offerName: "Master Beneficiary Data Bundle",
    validity: "60 Days",
    packages: AT_PACKAGES,
    accent: {
      border: "border-blue-400",
      ring: "ring-blue-400/40",
      bgSoft: "bg-blue-50",
      bg: "bg-blue-500",
      text: "text-blue-800",
      button: "bg-blue-500 hover:bg-blue-600 text-white",
      badge: "bg-blue-500 text-white",
      selectedPkg: "border-blue-400 bg-blue-50 ring-2 ring-blue-400/30",
    },
  },
  Telecel: {
    title: "Telecel Data Bundle",
    subtitle: "Purchase Telecel data packages instantly for yourself or your customers.",
    offerName: "Master Beneficiary Data Bundle",
    validity: "60 Days",
    packages: TELECEL_PACKAGES,
    accent: {
      border: "border-red-500",
      ring: "ring-red-500/40",
      bgSoft: "bg-red-50",
      bg: "bg-red-600",
      text: "text-red-800",
      button: "bg-red-600 hover:bg-red-700 text-white",
      badge: "bg-red-600 text-white",
      selectedPkg: "border-red-500 bg-red-50 ring-2 ring-red-500/30",
    },
  },
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidPhone(phone: string) {
  return /^\d{10}$/.test(phone);
}

const VIEW_MODE_KEY = "allen-data-view-mode";
const DISABLED_NETWORK_KEY = "portal-admin-network-disabled";

export function NetworkPurchasePage({ network }: { network: NetworkKey }) {
  const config = NETWORK_CONFIG[network];
  const { user, updateUser, applyReferralCommission } = useAuth();
  const { addItem } = useCart();

  const [disabledNetworks, setDisabledNetworks] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return saved === "grid" ? "grid" : "list";
  });
  const [packageCatalog, setPackageCatalog] = useState<Record<NetworkKey, DataPackage[]>>({
    MTN: MTN_PACKAGES,
    AirtelTigo: AT_PACKAGES,
    Telecel: TELECEL_PACKAGES,
  });
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [phone, setPhone] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [bulkRecipients, setBulkRecipients] = useState([""]);
  const [bulkRecipientPackages, setBulkRecipientPackages] = useState<string[]>([]);
  const [bulkPackageId, setBulkPackageId] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPackageId, setExcelPackageId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const firstPackage = packagesForNetwork[0];
    if (!firstPackage) return;

    setSelectedPackageId((current) => (current && packagesForNetwork.some((item) => item.id === current) ? current : firstPackage.id));
    setBulkPackageId((current) => (current && packagesForNetwork.some((item) => item.id === current) ? current : firstPackage.id));
    setExcelPackageId((current) => (current && packagesForNetwork.some((item) => item.id === current) ? current : firstPackage.id));
    setBulkRecipientPackages((current) => {
      if (current.length === 0) return [firstPackage.id];
      return current.map((item) => (packagesForNetwork.some((pkg) => pkg.id === item) ? item : firstPackage.id));
    });
  }, [packagesForNetwork]);

  useEffect(() => {
    const savedMode = localStorage.getItem(VIEW_MODE_KEY);
    if (savedMode === "grid" || savedMode === "list") {
      setViewMode(savedMode);
    } else {
      setViewMode("list");
      localStorage.setItem(VIEW_MODE_KEY, "list");
    }

    const loadNetworkStatus = async () => {
      try {
        const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
        const response = await fetch(`${apiBase}/api/network-settings`);
        if (!response.ok) return;
        const data = await response.json();
        const nextDisabled = Array.isArray(data?.settings)
          ? data.settings.filter((entry: { network?: string; enabled?: boolean }) => entry.enabled === false).map((entry) => entry.network).filter(Boolean)
          : [];
        setDisabledNetworks(nextDisabled);
      } catch {
        setDisabledNetworks([]);
      }
    };

    const loadPackages = async () => {
      try {
        const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
        const response = await fetch(`${apiBase}/api/packages`);
        if (!response.ok) return;
        const data = await response.json();
        const nextPackageMap = {
          MTN: (data.packages ?? []).filter((item: DataPackage) => item.network === "MTN"),
          AirtelTigo: (data.packages ?? []).filter((item: DataPackage) => item.network === "AirtelTigo"),
          Telecel: (data.packages ?? []).filter((item: DataPackage) => item.network === "Telecel"),
        } as Record<NetworkKey, DataPackage[]>;
        setPackageCatalog((current) => ({ ...current, ...nextPackageMap }));
      } catch {
        // keep fallback data
      }
    };

    void loadNetworkStatus();
    void loadPackages();
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const packagesForNetwork = (packageCatalog[network] ?? []).filter((p) => !disabledNetworks.includes(network));
  const selectedPackage = useMemo(
    () => packagesForNetwork.find((p) => p.id === selectedPackageId) ?? packagesForNetwork[0],
    [packagesForNetwork, selectedPackageId]
  );

  const bulkPackage = useMemo(
    () => packagesForNetwork.find((p) => p.id === bulkPackageId) ?? packagesForNetwork[0],
    [packagesForNetwork, bulkPackageId]
  );

  const addSelectedPackageToCart = (pkg: DataPackage, recipient?: string) => {
    const targetRecipient = recipient ?? "General";
    const promptedNumber = window.prompt("Enter the 10-digit recipient number to add to cart:", "");
    const normalized = promptedNumber ? normalizePhone(promptedNumber) : "";
    if (normalized && !isValidPhone(normalized)) {
      window.alert("Enter a valid 10-digit phone number.");
      return;
    }

    const recipientValue = normalized || targetRecipient;
    addItem({
      network,
      packageName: pkg.name,
      size: pkg.size,
      price: pkg.price,
      recipient: recipientValue,
    });

    if (user) {
      const nextBalance = Math.max(0, user.walletBalance - pkg.price);
      updateUser({ walletBalance: nextBalance });
      if (user.referredBy) {
        applyReferralCommission(user.referredBy, pkg.price);
      }
      window.alert(
        `Added ${pkg.size} to cart for ${recipientValue}.\nAmount: ${formatGHS(pkg.price)}\nWallet balance: ${formatGHS(nextBalance)}`
      );
    } else {
      window.alert(`Added ${pkg.size} to cart.`);
    }
  };

  const saveOrderRecord = async (order: {
    recipient: string;
    size: string;
    amount: number;
    network: NetworkKey;
    packageName: string;
    userId?: string | null;
  }) => {
    const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user?.id ? { "x-user-id": user.id } : {}),
      },
      body: JSON.stringify({
        ...order,
        date: new Date().toISOString(),
        status: "Pending",
        source: "web",
        paid: true,
        balBefore: user?.walletBalance ?? 0,
        balAfter: Math.max(0, (user?.walletBalance ?? 0) - order.amount),
      }),
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(msg || "Unable to save order.");
    }

    return response.json();
  };

  const placeSingleOrder = async () => {
    if (!selectedPackage) return;
    if (!isValidPhone(phone)) {
      window.alert("Enter a valid 10-digit recipient phone number.");
      return;
    }

    if (user) {
      const nextBalance = Math.max(0, user.walletBalance - selectedPackage.price);
      updateUser({ walletBalance: nextBalance });
      if (user.referredBy) {
        applyReferralCommission(user.referredBy, selectedPackage.price);
      }
      try {
        await saveOrderRecord({
          recipient: phone,
          size: selectedPackage.size,
          amount: selectedPackage.price,
          network,
          packageName: selectedPackage.name,
          userId: user.id,
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Unable to save order.");
      }
      window.alert(
        `Order placed successfully!\n${selectedPackage.size} for ${phone}\n` +
          `Amount: ${formatGHS(selectedPackage.price)}\n` +
          `New wallet balance: ${formatGHS(nextBalance)}` +
          (recurring ? "\n(Recurring order scheduled)" : "")
      );
    } else {
      window.alert("Please sign in to purchase directly.");
    }

    setPhone("");
    setRecurring(false);
  };

  const placeBulkOrder = async () => {
    const entries = bulkRecipients
      .map((recipient, index) => ({
        recipient: normalizePhone(recipient.trim()),
        pkgId: bulkRecipientPackages[index] || bulkPackageId || packagesForNetwork[0]?.id || "",
      }))
      .filter(({ recipient }) => recipient);

    if (entries.length === 0) {
      window.alert("Enter at least one recipient phone number.");
      return;
    }

    const invalid = entries.filter(({ recipient }) => !isValidPhone(recipient));
    if (invalid.length > 0) {
      window.alert(`Invalid phone number(s): ${invalid.slice(0, 5).map(({ recipient }) => recipient).join(", ")}`);
      return;
    }

    const groupedOrders = entries.map(({ recipient, pkgId }) => {
      const pkg = packagesForNetwork.find((item) => item.id === pkgId) ?? bulkPackage ?? packagesForNetwork[0];
      return { recipient, pkg };
    });

    const total = groupedOrders.reduce((sum, { pkg }) => sum + pkg.price, 0);
    if (user) {
      const nextBalance = Math.max(0, user.walletBalance - total);
      updateUser({ walletBalance: nextBalance });
      if (user.referredBy) {
        applyReferralCommission(user.referredBy, total);
      }
      try {
        await Promise.all(
          groupedOrders.map(({ recipient, pkg }) =>
            saveOrderRecord({
              recipient,
              size: pkg.size,
              amount: pkg.price,
              network,
              packageName: pkg.name,
              userId: user.id,
            })
          )
        );
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Unable to save bulk order.");
      }
      window.alert(
        `Bulk order placed!\n${groupedOrders.length} recipient(s)\n` +
          `Total: ${formatGHS(total)}\n` +
          `New wallet balance: ${formatGHS(nextBalance)}`
      );
    } else {
      window.alert("Please sign in to purchase directly.");
    }

    setBulkRecipients([""]);
    setBulkRecipientPackages([packagesForNetwork[0]?.id ?? ""]);
  };

  const handleExcelUpload = () => {
    if (!excelFile) {
      window.alert("Please choose an Excel (.xlsx / .csv) file first.");
      return;
    }
    const pkg = packagesForNetwork.find((p) => p.id === excelPackageId) ?? packagesForNetwork[0];
    window.alert(
      `File "${excelFile.name}" queued for processing` +
        (pkg ? ` with package ${pkg.size} (${formatGHS(pkg.price)}).` : ".")
    );
    setExcelFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (disabledNetworks.includes(network)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-lg border-blue-200 bg-blue-50">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-blue-700">{network} is currently unavailable</h2>
            <p className="mt-3 text-sm text-blue-700/80">This network has been disabled by the admin and will not appear as available to users.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="rounded-2xl border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-violet-700 dark:text-violet-400">
              {config.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{config.subtitle}</p>
          </div>
          <WalletPill balance={user?.walletBalance ?? 0} />
        </CardContent>
      </Card>

      {/* Select Offer */}
      <Card
        className={cn(
          "rounded-2xl border-2 bg-white shadow-sm transition-colors dark:bg-slate-900",
          config.accent.border,
          config.accent.bgSoft
        )}
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                config.accent.bg
              )}
            >
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={cn("text-lg font-semibold", config.accent.text)}>
                  {config.offerName}
                </h2>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    config.accent.badge
                  )}
                >
                  Selected
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Validity: <span className="font-medium">{config.validity}</span>
                <span className="mx-2 text-slate-300">·</span>
                <StatusBadge status="Active" />
                <span className="mx-2 text-slate-300">·</span>
                {packagesForNetwork.length} packages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? cn(config.accent.bgSoft, config.accent.text)
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "grid"
                  ? cn(config.accent.bgSoft, config.accent.text)
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "grid" && (
        <Card className="rounded-2xl border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Available Packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {packagesForNetwork.map((pkg) => {
                const active = pkg.id === selectedPackageId;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setBulkPackageId(pkg.id);
                      setExcelPackageId(pkg.id);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950",
                      active && config.accent.selectedPkg
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={cn("font-bold", active ? config.accent.text : "text-slate-900 dark:text-slate-100")}>
                          {pkg.size}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{pkg.validity}</p>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {network}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className={cn("font-semibold", active ? config.accent.text : "text-slate-800 dark:text-slate-200")}>
                        {formatGHS(pkg.price)}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className={cn("h-8 gap-1 px-3 text-xs", config.accent.button)}
                        onClick={(event) => {
                          event.stopPropagation();
                          addSelectedPackageToCart(pkg);
                        }}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add to cart
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "list" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-slate-100 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Place Order</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="single">
                <TabsList className="mb-5 grid h-auto w-full grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <TabsTrigger value="single" className="rounded-lg data-[state=active]:shadow-sm dark:text-slate-200">
                    Single
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="rounded-lg data-[state=active]:shadow-sm dark:text-slate-200">
                    Bulk
                  </TabsTrigger>
                  <TabsTrigger value="excel" className="rounded-lg data-[state=active]:shadow-sm dark:text-slate-200">
                    Excel
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-phone">Recipient Phone Number</Label>
                    <Input
                      id="recipient-phone"
                      placeholder="e.g. 0249116309"
                      value={phone}
                      maxLength={10}
                      onChange={(e) => setPhone(normalizePhone(e.target.value))}
                      className="h-11 font-mono tracking-wider"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Package</Label>
                    <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packagesForNetwork.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.size} — {formatGHS(pkg.price)} ({pkg.validity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <Checkbox
                      id="recurring"
                      checked={recurring}
                      onCheckedChange={(v) => setRecurring(v === true)}
                    />
                    <Label htmlFor="recurring" className="cursor-pointer text-sm font-medium">
                      Make this a recurring order
                    </Label>
                  </div>

                  <Button
                    type="button"
                    onClick={placeSingleOrder}
                    className={cn("h-11 w-full font-semibold shadow-sm", config.accent.button)}
                  >
                    Place Order
                    {selectedPackage ? ` · ${formatGHS(selectedPackage.price)}` : ""}
                  </Button>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Recipients</Label>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {bulkRecipients.filter((value) => value.trim()).length} recipient{bulkRecipients.filter((value) => value.trim()).length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {bulkRecipients.map((recipient, index) => (
                        <div key={index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Recipient {index + 1}
                              </Label>
                              <Input
                                value={recipient}
                                onChange={(e) => {
                                  const next = [...bulkRecipients];
                                  next[index] = e.target.value;
                                  setBulkRecipients(next);
                                }}
                                placeholder="e.g. 0249116309"
                                className="h-11 font-mono tracking-wider"
                              />
                            </div>
                            {bulkRecipients.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-xl text-slate-500 hover:text-rose-600"
                                onClick={() => {
                                  setBulkRecipients((current) => current.filter((_, i) => i !== index));
                                  setBulkRecipientPackages((current) => current.filter((_, i) => i !== index));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Package</Label>
                            <Select
                              value={bulkRecipientPackages[index] ?? bulkPackageId}
                              onValueChange={(value) => {
                                const next = [...bulkRecipientPackages];
                                next[index] = value;
                                setBulkRecipientPackages(next);
                              }}
                            >
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select a package" />
                              </SelectTrigger>
                              <SelectContent>
                                {packagesForNetwork.map((pkg) => (
                                  <SelectItem key={pkg.id} value={pkg.id}>
                                    {pkg.size} — {formatGHS(pkg.price)} ({pkg.validity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl dark:border-slate-700 dark:text-slate-200"
                      onClick={() => {
                        setBulkRecipients((current) => [...current, ""]);
                        setBulkRecipientPackages((current) => [...current, packagesForNetwork[0]?.id ?? ""]);
                      }}
                    >
                      Add Recipient
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Package</Label>
                    <Select value={bulkPackageId} onValueChange={setBulkPackageId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packagesForNetwork.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.size} — {formatGHS(pkg.price)} ({pkg.validity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    onClick={placeBulkOrder}
                    className={cn("h-11 w-full font-semibold shadow-sm", config.accent.button)}
                  >
                    Place Bulk Order
                  </Button>
                </TabsContent>

                <TabsContent value="excel" className="space-y-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-slate-300 hover:bg-slate-100/80",
                      excelFile && config.accent.bgSoft
                    )}
                  >
                    <div
                      className={cn(
                        "mb-3 flex h-12 w-12 items-center justify-center rounded-full",
                        config.accent.bgSoft,
                        config.accent.text
                      )}
                    >
                      {excelFile ? (
                        <FileSpreadsheet className="h-6 w-6" />
                      ) : (
                        <Upload className="h-6 w-6" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {excelFile ? excelFile.name : "Drop Excel file here or click to upload"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Supported formats: .xlsx, .xls, .csv
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">Upload instructions</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      <li>Column A: Recipient phone number (10 digits)</li>
                      <li>Optional Column B: Package size (e.g. 5GB) — overrides selection below</li>
                      <li>First row may be a header and will be skipped if non-numeric</li>
                      <li>Maximum 500 rows per upload</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Package</Label>
                    <Select value={excelPackageId} onValueChange={setExcelPackageId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packagesForNetwork.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.size} — {formatGHS(pkg.price)} ({pkg.validity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    onClick={handleExcelUpload}
                    className={cn("h-11 w-full font-semibold shadow-sm", config.accent.button)}
                  >
                    Process Excel Upload
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="h-fit rounded-2xl border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Recurring Orders
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                0 active
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">No recurring orders yet</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Enable &quot;Make this a recurring order&quot; when placing a single order to schedule
                  automatic top-ups for the same recipient.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default NetworkPurchasePage;
