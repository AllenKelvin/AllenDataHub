import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, MessageCircle, Save, Store, WalletCards } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { formatGHS } from "@/lib/formatters";
import type { DataPackage } from "@/lib/types";

interface StoreProfile { storeName: string; contactPhone: string; whatsappNumber: string; slug: string; link: string; }
interface Analytics { totalOrders: number; totalCommissions: number; walletBalance: number; }

export default function MiniStoreDashboard() {
  const { user } = useAuth();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [packages, setPackages] = useState<Array<DataPackage & { basePrice: number; customPrice: number }>>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ totalOrders: 0, totalCommissions: 0, walletBalance: 0 });
  const [form, setForm] = useState({ storeName: "", contactPhone: user?.phone || "", whatsappNumber: user?.whatsapp || "" });
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!user?.id) return;
    const headers = { "x-user-id": user.id };
    const [storeResponse, productResponse, analyticsResponse] = await Promise.all([
      fetch(`${getApiBase()}/api/agent/store`, { headers }),
      fetch(`${getApiBase()}/api/products`, { headers }),
      fetch(`${getApiBase()}/api/agent/store/analytics`, { headers }),
    ]);
    const storeData = await storeResponse.json();
    const productData = await productResponse.json();
    const analyticsData = await analyticsResponse.json();
    if (storeData.store) {
      setStore(storeData.store);
      setForm({ storeName: storeData.store.storeName, contactPhone: storeData.store.contactPhone, whatsappNumber: storeData.store.whatsappNumber });
    }
    setPackages((productData.products || []).map((item: DataPackage) => ({ ...item, basePrice: Number(item.agentPrice ?? item.price), customPrice: Number(item.agentPrice ?? item.price) })));
    if (analyticsData.analytics) setAnalytics(analyticsData.analytics);
  };

  useEffect(() => { void load(); }, [user?.id]);
  const totalConfigured = useMemo(() => packages.filter((item) => item.customPrice >= item.basePrice).length, [packages]);

  const saveStore = async () => {
    setMessage("");
    const response = await fetch(`${getApiBase()}/api/agent/store`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to save store.");
    setStore(data.store); setMessage("Store profile saved.");
  };

  const savePricing = async () => {
    const response = await fetch(`${getApiBase()}/api/agent/store/pricing`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify({ pricing: packages.map(({ id, customPrice }) => ({ packageId: id, customPrice })) }) });
    const data = await response.json();
    setMessage(response.ok ? "Prices saved." : data.error || "Unable to save prices.");
    if (response.ok) await load();
  };

  const publicLink = store?.link || "";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Agent tools</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Your mini-store</h1><p className="mt-1 text-slate-500">Turn your package margins into a shareable checkout.</p></div>
      {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {[["Total earnings", formatGHS(analytics.totalCommissions)], ["Wallet balance", formatGHS(analytics.walletBalance)], ["Total orders", String(analytics.totalOrders)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><WalletCards className="h-5 w-5 text-emerald-500" /></div><p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div>)}
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3"><Store className="h-5 w-5 text-emerald-600" /><div><h2 className="font-semibold text-slate-900 dark:text-white">Store profile</h2><p className="text-sm text-slate-500">This information appears on your public checkout.</p></div></div>
      <div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Store name<input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Ama Data Hub" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact phone<input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp number<input value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></label></div>
      <button onClick={() => void saveStore()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4" />Save profile</button>
      {publicLink && <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><span className="min-w-0 flex-1 truncate">{publicLink}</span><button title="Copy link" onClick={() => void navigator.clipboard.writeText(publicLink)} className="rounded-lg bg-white p-2 shadow-sm"><Copy className="h-4 w-4" /></button><a href={`https://wa.me/?text=${encodeURIComponent(`Shop from ${store?.storeName}: ${publicLink}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white"><MessageCircle className="h-4 w-4" />Share</a></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">Package pricing</h2><p className="text-sm text-slate-500">{totalConfigured} packages ready to sell.</p></div><button onClick={() => void savePricing()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Save prices</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Package</th><th>Base price</th><th>Your price</th><th>Profit</th></tr></thead><tbody>{packages.map((item, index) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 font-medium">{item.network} · {item.size}</td><td>{formatGHS(item.basePrice)}</td><td><input type="number" min={item.basePrice} step="0.01" value={item.customPrice} onChange={(event) => setPackages((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, customPrice: Number(event.target.value) } : entry))} className="h-9 w-28 rounded-md border px-2 dark:border-slate-700 dark:bg-slate-950" /></td><td className="font-semibold text-emerald-600">{formatGHS(Math.max(0, item.customPrice - item.basePrice))}</td></tr>)}</tbody></table></div></section>
  </div>;
}

export function PublicMiniStore({ slug }: { slug: string }) {
  const [store, setStore] = useState<{ id: string; storeName: string; whatsappNumber: string } | null>(null);
  const [packages, setPackages] = useState<Array<DataPackage & { customPrice: number }>>([]);
  const [selected, setSelected] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState("");
  useEffect(() => { fetch(`${getApiBase()}/api/public/store/${encodeURIComponent(slug)}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setStore(data.store); setPackages(data.packages || []); setSelected(data.packages?.[0]?.id || ""); }).catch((reason) => setError(reason.message || "Store not found.")); }, [slug]);
  const selectedPackage = packages.find((item) => item.id === selected);
  const checkout = async () => { if (!selectedPackage || !/^\d{10}$/.test(phone)) return setError("Choose a package and enter a valid 10-digit recipient number."); const response = await fetch(`${getApiBase()}/api/public/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store?.id, packageId: selectedPackage.id, recipientPhone: phone }) }); const data = await response.json(); if (!response.ok) return setError(data.error || "Unable to start payment."); window.location.href = data.authorizationUrl; };
  if (error && !store) return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white"><div><h1 className="text-3xl font-bold">Store unavailable</h1><p className="mt-2 text-slate-400">{error}</p></div></div>;
  return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><main className="mx-auto max-w-lg"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">AllenDataHub mini-store</p><h1 className="mt-3 text-4xl font-bold">{store?.storeName || "Loading store..."}</h1><p className="mt-2 text-slate-400">Choose a package, enter the recipient, and pay securely.</p></div><div className="space-y-3">{packages.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected === item.id ? "border-emerald-400 bg-emerald-400/10" : "border-slate-800 bg-slate-900"}`}><div className="flex justify-between"><span className="font-semibold">{item.network} · {item.size}</span><span className="font-bold text-emerald-400">{formatGHS(item.customPrice)}</span></div><p className="mt-1 text-sm text-slate-400">{item.validity}</p></button>)}</div><label className="mt-6 block text-sm font-medium text-slate-300">Recipient phone<input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white" placeholder="0240000000" /></label>{error && <p className="mt-3 text-sm text-rose-400">{error}</p>}<button onClick={() => void checkout()} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400">Pay now</button><a href={`https://wa.me/${store?.whatsappNumber?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg" title="Contact on WhatsApp"><MessageCircle /></a></main></div>;
}
