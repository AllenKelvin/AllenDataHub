import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { data: user, isLoading } = useUser();
  const [amount, setAmount] = useState<number>(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="h-[50vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const userEmail = user.email || user.username || '';

  async function fundWallet() {
    if (!user) return;
    if (amount <= 0) return toast({ title: 'Invalid amount', variant: 'destructive' });
    try {
      const resp = await fetch('/api/paystack/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), email: userEmail, metadata: { type: 'wallet', agentId: user.id } }),
      });
      const data = await resp.json();
      if (data && (data.data?.authorization_url || data.authorization_url)) {
        const url = data.data?.authorization_url || data.authorization_url;
        window.location.href = url;
      } else {
        toast({ title: 'Payment init failed', description: 'Could not initialize Paystack', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to initialize payment', variant: 'destructive' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-border/50">
        <h2 className="text-xl font-bold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-2">Username: {user.username}</p>
        <p className="text-sm text-muted-foreground">Email: {user.email || '—'}</p>
        <p className="text-sm text-muted-foreground">Role: {user.role}</p>
        {user.role === 'agent' && (
            <div className="mt-4">
              <h3 className="font-semibold">Agent Wallet</h3>
              <p className="text-sm text-muted-foreground mb-2">Balance: GHS {(user.balance || 0)}</p>
              <div className="flex gap-2 items-center">
                <Button onClick={() => setLocation('/fund-wallet')}>Fund Account</Button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
