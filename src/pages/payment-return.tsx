import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function PaymentReturnPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("Confirming your Paystack payment...");
  const [failed, setFailed] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const reference = new URLSearchParams(window.location.search).get("reference");

    if (!user?.id) {
      setMessage("Please sign in again to view your wallet balance.");
      setFailed(true);
      return;
    }

    if (!reference) {
      setMessage("No Paystack payment reference was found.");
      setFailed(true);
      return;
    }

    let active = true;
    const verifyPayment = async () => {
      for (let attempt = 0; attempt < 3 && active; attempt += 1) {
        const response = await fetch(`${getApiBase()}/api/payments/paystack/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id,
          },
          body: JSON.stringify({ reference }),
        });
        const data = await response.json().catch(() => ({}));

        if (data?.ok && data?.verified && !data?.pending) {
          setSucceeded(true);
          setFailed(false);
          setMessage("Payment successful. Return to your wallet to apply the funds.");
          return;
        }

        if (!response.ok && response.status !== 202) {
          throw new Error(data?.error || "Payment verification failed.");
        }

        setMessage("Payment received. Waiting for Paystack confirmation...");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }

      if (active) {
        setMessage("Payment is still being confirmed. Please return here shortly and try again.");
      }
    };

    void verifyPayment().catch((error) => {
      if (!active) return;
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Payment verification failed.");
    });

    return () => {
      active = false;
    };
  }, [isLoading, refreshUser, setLocation, user?.id]);

  const completePayment = async () => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference || !user?.id) return;
    setCompleting(true);
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
      if (!response.ok || data?.pending) {
        throw new Error(data?.error || "Payment is still being confirmed.");
      }
      await refreshUser();
      setLocation("/user/wallet");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update your wallet.");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {failed ? (
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
        ) : succeeded ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        ) : (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
        )}
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          {failed ? "Payment update" : "Paystack payment"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        {succeeded && !failed && (
          <Button className="mt-6 rounded-xl" onClick={() => void completePayment()} disabled={completing}>
            {completing ? "Updating wallet..." : "Return to wallet"}
          </Button>
        )}
        {failed && (
          <Button className="mt-6 rounded-xl" onClick={() => setLocation("/user/wallet")}>
            Return to wallet
          </Button>
        )}
      </div>
    </div>
  );
}
