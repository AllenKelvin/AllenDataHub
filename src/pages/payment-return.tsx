import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function PaymentReturnPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const reference = new URLSearchParams(window.location.search).get("reference")
    || new URLSearchParams(window.location.search).get("trxref");
  const [status, setStatus] = useState("Checking your payment...");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!reference) {
      setStatus("No payment reference was returned. Check your wallet history for the payment status.");
      setIsChecking(false);
      return;
    }
    if (!user?.id) {
      setStatus("Sign in to verify this payment and receive your wallet credit.");
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    const checkPayment = async () => {
      try {
        const response = await fetch(`${getApiBase()}/api/payments/paystack/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id,
          },
          body: JSON.stringify({ reference }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to verify this payment.");
        if (cancelled) return;
        setStatus(data.pending
          ? "Your payment is still being confirmed. Your wallet will update when Paystack confirms it."
          : data.message || "Payment verified and wallet credited.");
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Unable to verify this payment.");
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void checkPayment();
    return () => {
      cancelled = true;
    };
  }, [isLoading, reference, user?.id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className={`mx-auto h-12 w-12 ${isChecking ? "text-slate-400" : "text-emerald-500"}`} />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{isChecking ? "Confirming payment" : "Payment status"}</h1>
        <p className="mt-2 text-sm text-slate-500">{status}</p>
        {reference && <p className="mt-3 break-all text-xs text-slate-400">Reference: {reference}</p>}
        <Button className="mt-6 rounded-xl" onClick={() => setLocation("/user/wallet")}><ArrowLeft className="mr-2 h-4 w-4" />Return to wallet</Button>
      </div>
    </div>
  );
}
