import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, Loader2, MessageCircle, Phone, Save, Store, WalletCards, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { formatGHS } from "@/lib/formatters";
import type { DataPackage } from "@/lib/types";

interface StoreProfile { id?: string; storeName: string; contactPhone: string; whatsappNumber: string; slug: string; link: string; pricing?: Array<DataPackage & { basePrice: number; customPrice: number }>; }
interface Analytics { totalOrders: number; totalCommissions: number; walletBalance: number; }

export default function MiniStoreDashboard() {
  const { user } = useAuth();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [packages, setPackages] = useState<Array<DataPackage & { basePrice: number; customPrice: number }>>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ totalOrders: 0, totalCommissions: 0, walletBalance: 0 });
  const [form, setForm] = useState({ storeName: "", contactPhone: user?.phone || "", whatsappNumber: user?.whatsapp || "" });
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [processingAction, setProcessingAction] = useState("");

  const load = async () => {
    if (!user?.id) return;
    try {
      const headers = { "x-user-id": user.id };
      const [storeResponse, productResponse, analyticsResponse] = await Promise.all([
        fetch(`${getApiBase()}/api/agent/store`, { headers }),
        fetch(`${getApiBase()}/api/products`, { headers }),
        fetch(`${getApiBase()}/api/agent/store/analytics`, { headers }),
      ]);
      const storeData = await storeResponse.json().catch(() => ({}));
      const productData = await productResponse.json().catch(() => ({}));
      const analyticsData = await analyticsResponse.json().catch(() => ({}));
      if (!storeResponse.ok) {
        setMessageIsError(true);
        setMessage(storeData.error || `Unable to load your store (${storeResponse.status}).`);
      } else if (storeData.store) {
        setStore(storeData.store);
        setForm({ storeName: storeData.store.storeName, contactPhone: storeData.store.contactPhone, whatsappNumber: storeData.store.whatsappNumber });
      }
      if (Array.isArray(productData.products)) {
        const savedPricing = new Map((storeData.store?.pricing || []).map((item: DataPackage & { customPrice: number }) => [item.id, item.customPrice]));
        setPackages(productData.products.map((item: DataPackage) => ({ ...item, basePrice: Number(item.agentPrice ?? item.price), customPrice: Number(savedPricing.get(item.id) ?? item.agentPrice ?? item.price) })));
      }
      if (analyticsData.analytics) setAnalytics(analyticsData.analytics);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to load your store.");
    }
  };

  useEffect(() => { void load(); }, [user?.id]);
  const totalConfigured = useMemo(() => packages.filter((item) => item.customPrice >= item.basePrice).length, [packages]);

  const saveStore = async () => {
    if (savingStore) return;
    if (!form.storeName.trim() || !form.contactPhone.trim() || !form.whatsappNumber.trim()) {
      setMessageIsError(true);
      setMessage("Enter a store name, contact phone, and WhatsApp number before saving.");
      return;
    }
    setSavingStore(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`${getApiBase()}/api/agent/store`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Unable to save store (${response.status}).`);
      if (!data.store?.slug || !data.store?.link) throw new Error("Store saved, but the public link was not returned. Please refresh and try again.");
      setStore(data.store);
      setMessage("Store profile saved. Your share link is ready.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to save store. Check your connection and try again.");
    } finally {
      setSavingStore(false);
    }
  };

  const savePricing = async () => {
    if (savingPricing) return;
    setSavingPricing(true);
    setMessageIsError(false);
    try {
      const response = await fetch(`${getApiBase()}/api/agent/store/pricing`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify({ pricing: packages.map(({ id, customPrice }) => ({ packageId: id, customPrice })) }) });
      const data = await response.json().catch(() => ({}));
      setMessageIsError(!response.ok);
      setMessage(response.ok ? "Prices saved." : data.error || "Unable to save prices.");
      if (response.ok) await load();
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to save prices.");
    } finally {
      setSavingPricing(false);
    }
  };

  const publicLink = store?.link || "";
  const canManageStore = user?.role === "agent";

  const runAction = async (action: string, callback: () => Promise<void> | void) => {
    if (processingAction) return;
    setProcessingAction(action);
    try { await callback(); } finally { setProcessingAction(""); }
  };

  const copyLink = () => runAction("copy", async () => {
    await navigator.clipboard.writeText(publicLink);
    setMessageIsError(false);
    setMessage("Store link copied.");
  });

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Agent tools</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Your mini-store</h1><p className="mt-1 text-slate-500">Turn your package margins into a shareable checkout.</p></div>
      {message && <p className={`flex items-center gap-2 text-sm font-medium ${messageIsError ? "text-rose-600" : "text-emerald-600"}`}>{!messageIsError && <Check className="h-4 w-4" />}{message}</p>}
    </div>
    {!canManageStore && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Mini-stores are available only for Agent accounts. This account is currently signed in as <strong>{user?.role || "unknown"}</strong>.</div>}
    <div className="grid gap-4 md:grid-cols-3">
      {[["Total earnings", formatGHS(analytics.totalCommissions)], ["Wallet balance", formatGHS(analytics.walletBalance)], ["Total orders", String(analytics.totalOrders)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><WalletCards className="h-5 w-5 text-emerald-500" /></div><p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div>)}
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3"><Store className="h-5 w-5 text-emerald-600" /><div><h2 className="font-semibold text-slate-900 dark:text-white">Store profile</h2><p className="text-sm text-slate-500">This information appears on your public checkout.</p></div></div>
      <div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Store name<input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Ama Data Hub" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact phone<input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp number<input value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></label></div>
      <button disabled={savingStore} onClick={() => void saveStore()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{savingStore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{savingStore ? "Saving..." : "Save profile"}</button>
      {publicLink && <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><span className="min-w-0 flex-1 truncate">{publicLink}</span><button title="Copy link" disabled={!!processingAction} onClick={() => void copyLink()} className="inline-flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm disabled:opacity-60">{processingAction === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}</button><a href={`https://wa.me/?text=${encodeURIComponent(`Shop from ${store?.storeName}: ${publicLink}`)}`} target="_blank" rel="noreferrer" onClick={() => setProcessingAction("share")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white"><MessageCircle className="h-4 w-4" />{processingAction === "share" ? "Opening..." : "Share"}</a></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">Package pricing</h2><p className="text-sm text-slate-500">{totalConfigured} packages ready to sell.</p></div><button disabled={savingPricing} onClick={() => void savePricing()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900">{savingPricing && <Loader2 className="h-4 w-4 animate-spin" />}{savingPricing ? "Saving..." : "Save prices"}</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Package</th><th>Base price</th><th>Your price</th><th>Profit</th></tr></thead><tbody>{packages.map((item, index) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 font-medium">{item.network} · {item.size}</td><td>{formatGHS(item.basePrice)}</td><td><input type="number" min={item.basePrice} step="0.01" value={item.customPrice} onChange={(event) => setPackages((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, customPrice: Number(event.target.value) } : entry))} className="h-9 w-28 rounded-md border px-2 dark:border-slate-700 dark:bg-slate-950" /></td><td className="font-semibold text-emerald-600">{formatGHS(Math.max(0, item.customPrice - item.basePrice))}</td></tr>)}</tbody></table></div></section>
    <div className="flex flex-wrap justify-center gap-3"><a href={`tel:${store?.contactPhone || form.contactPhone}`} onClick={() => setProcessingAction("call")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm"><Phone className="h-4 w-4" />{processingAction === "call" ? "Calling..." : "Call store"}</a><a href={`https://wa.me/${(store?.whatsappNumber || form.whatsappNumber).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={() => setProcessingAction("whatsapp")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950"><MessageCircle className="h-4 w-4" />{processingAction === "whatsapp" ? "Opening..." : "WhatsApp"}</a></div>
  </div>;
}

export function PublicMiniStore({ slug }: { slug: string }) {
  const [store, setStore] = useState<{ id: string; storeName: string; whatsappNumber: string; contactPhone: string } | null>(null);
  const [packages, setPackages] = useState<Array<DataPackage & { customPrice: number }>>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<DataPackage["network"]>("MTN");
  const [selected, setSelected] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");
  const [guestOrder, setGuestOrder] = useState<{ paid: boolean; status: string; reference: string } | null>(null);
  const paymentReference = new URLSearchParams(window.location.search).get("reference") || new URLSearchParams(window.location.search).get("trxref");
  useEffect(() => { fetch(`${getApiBase()}/api/public/store/${encodeURIComponent(slug)}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setStore(data.store); setPackages(data.packages || []); }).catch((reason) => setError(reason.message || "Store not found.")); }, [slug]);
  useEffect(() => { if (!paymentReference) return; fetch(`${getApiBase()}/api/public/order-status?slug=${encodeURIComponent(slug)}&reference=${encodeURIComponent(paymentReference)}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setGuestOrder(data); }).catch(() => setGuestOrder({ paid: true, status: "Payment received", reference: paymentReference })); }, [paymentReference, slug]);
  const selectedPackage = packages.find((item) => item.id === selected); const visiblePackages = packages.filter((item) => item.network === selectedNetwork);
  const checkout = async () => { if (processing) return; setProcessing("pay"); setError(""); try { if (!selectedPackage || !/^\d{10}$/.test(phone)) throw new Error("Choose a package and enter a valid 10-digit recipient number."); const response = await fetch(`${getApiBase()}/api/public/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store?.id, packageId: selectedPackage.id, recipientPhone: phone }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to start payment."); window.location.href = data.authorizationUrl; } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start payment."); setProcessing(""); } };
  if (error && !store) return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white"><div><h1 className="text-3xl font-bold">Store unavailable</h1><p className="mt-2 text-slate-400">{error}</p></div></div>;
  if (guestOrder && store) return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><main className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center"><div className="w-full rounded-3xl bg-white p-8 text-center text-slate-900 shadow-2xl"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{store.storeName}</p><h1 className="mt-2 text-3xl font-bold">Order placed successfully</h1><p className="mt-3 text-sm text-slate-600">Your payment has been received and your data order is being processed.</p><p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Status: {guestOrder.status}</p><p className="mt-5 text-sm text-slate-600">If your order has not arrived within one hour, contact the agent directly.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><a href={`tel:${store.contactPhone}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-semibold"><Phone className="h-4 w-4" />{store.contactPhone}</a><a href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"><MessageCircle className="h-4 w-4" />WhatsApp</a></div><p className="mt-5 break-all text-xs text-slate-400">Reference: {guestOrder.reference}</p></div></main></div>;
  return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><main className="mx-auto max-w-lg"><div className="mb-8 text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">AllenDataHub mini-store</p><h1 className="mt-3 text-4xl font-bold">{store?.storeName || "Loading store..."}</h1><p className="mt-2 text-slate-400">Fast &amp; Reliable Services Powered by AllenDataHub</p></div><div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-2">{(["MTN", "Telecel", "AirtelTigo"] as DataPackage["network"][]).map((network) => <button key={network} onClick={() => { setSelectedNetwork(network); setSelected(""); }} className={`rounded-xl px-2 py-3 text-sm font-bold ${selectedNetwork === network ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}>{network}</button>)}</div><div className="mt-5 space-y-3">{visiblePackages.map((item) => <button key={item.id} onClick={() => { setSelected(item.id); setPhone(""); setError(""); }} className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-emerald-400"><div className="flex justify-between"><span className="font-semibold">{item.size}</span><span className="font-bold text-emerald-400">{formatGHS(item.customPrice)}</span></div><p className="mt-1 text-sm text-slate-400">{item.validity}</p></button>)}</div>{error && <p className="mt-3 text-center text-sm text-rose-400">{error}</p>}<div className="mt-7 flex justify-center gap-3"><a href={`tel:${store?.contactPhone || ""}`} onClick={() => setProcessing("call")} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900"><Phone className="h-4 w-4" />{processing === "call" ? "Calling..." : "Call"}</a><a href={`https://wa.me/${store?.whatsappNumber?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={() => setProcessing("whatsapp")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"><MessageCircle className="h-4 w-4" />{processing === "whatsapp" ? "Opening..." : "WhatsApp"}</a></div></main>{selected && selectedPackage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Selected package</p><h2 className="text-xl font-bold">{selectedPackage.network} {selectedPackage.size}</h2><p className="mt-1 font-semibold text-emerald-600">{formatGHS(selectedPackage.customPrice)}</p></div><button onClick={() => setSelected("")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div><label className="mt-6 block text-sm font-semibold">Recipient phone<input autoFocus value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4" placeholder="0240000000" /></label><button disabled={!!processing} onClick={() => void checkout()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-60">{processing === "pay" && <Loader2 className="h-4 w-4 animate-spin" />}{processing === "pay" ? "Processing payment..." : "Pay now"}</button></div></div>}</div>;
}
