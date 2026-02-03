import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentReturnPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const qc = useQueryClient();

  const params = new URLSearchParams(search);
  const reference = params.get("reference");
  const success = params.get("trxref") || reference;

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["/api/cart"] });
    qc.invalidateQueries({ queryKey: [api.orders.listMyOrders.path] });
    qc.invalidateQueries({ queryKey: ["/api/user"] });
  }, [qc]);

  const isSuccess = !!success;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-border p-8 text-center">
        {isSuccess ? (
          <>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Your order has been placed. You can view it in Recent Orders on your dashboard.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Processing Payment</h1>
            <p className="text-muted-foreground mb-6">
              Please wait while we confirm your payment...
            </p>
          </>
        )}
        <Button
          onClick={() => setLocation("/")}
          className="w-full bg-primary hover:bg-primary/90"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
