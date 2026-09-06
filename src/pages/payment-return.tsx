import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function PaymentReturnPage() {
  const [, setLocation] = useLocation();
  const reference = new URLSearchParams(window.location.search).get("reference")
    || new URLSearchParams(window.location.search).get("trxref");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Payment received</h1>
        <p className="mt-2 text-sm text-slate-500">Paystack has returned you to AllenDataHub. Your wallet will be updated by the payment webhook.</p>
        {reference && <p className="mt-3 break-all text-xs text-slate-400">Reference: {reference}</p>}
        <Button className="mt-6 rounded-xl" onClick={() => setLocation("/user/wallet")}><ArrowLeft className="mr-2 h-4 w-4" />Return to wallet</Button>
      </div>
    </div>
  );
}
