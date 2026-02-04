import { useState } from 'react';
import { useUser } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

export default function FundWalletPage() {
  const { data: user, isLoading } = useUser();
  const [amount, setAmount] = useState<number>(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="h-[50vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  async function fundWallet() {
    if (amount <= 0) return toast({ title: 'Invalid amount', variant: 'destructive' });
    try {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const resp = await fetchWithAuth('/api/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ amount: Math.round(amount * 100), email: user.email || user.username || '', metadata: { type: 'wallet', agentId: user.id } }),
      });
      const data = await resp.json();
      if (data && (data.data?.authorization_url || data.authorization_url)) {
        const url = data.data?.authorization_url || data.authorization_url;
        toast({ title: 'Redirecting', description: 'Redirecting to Paystack...', variant: 'default' });
        setTimeout(() => { window.location.href = url; }, 200);
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
        <h2 className="text-xl font-bold">Fund Wallet</h2>
        <p className="text-sm text-muted-foreground mt-2">Top up your agent wallet using Paystack.</p>
        <div className="mt-4 flex gap-2 items-center">
          <Input type="number" placeholder="Amount (GHS)" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Button onClick={fundWallet}>Pay</Button>
        </div>
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setLocation('/profile')}>Back to Profile</Button>
        </div>
      </div>
    </div>
  );
}
