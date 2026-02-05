import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const BACKEND_URL = "https://allen-data-hub-backend.onrender.com";

export default function ProfilePage() {
  const { data: user, isLoading } = useUser();
  const [amount, setAmount] = useState<number>(0);
  const [email, setEmail] = useState<string>('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  if (isLoading) return <div className="h-[50vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const userEmail = user.email || user.username || '';

  async function updateEmail() {
    if (!email || !email.includes('@')) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    setIsSavingEmail(true);
    try {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const resp = await fetchWithAuth('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        throw new Error('Failed to update email');
      }
      const updated = await resp.json();
      qc.setQueryData(['api/user'], updated);
      toast({ title: 'Success', description: 'Email updated successfully' });
      setEmail('');
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'Failed to update email', variant: 'destructive' });
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function fundWallet() {
    if (!user) return;
    if (amount <= 0) return toast({ title: 'Invalid amount', variant: 'destructive' });
    try {
      const { fetchWithAuth } = await import('@/lib/fetchWithAuth');
      const resp = await fetchWithAuth('/api/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ amount: Math.round(amount * 100), email: userEmail, metadata: { type: 'wallet', agentId: user.id } }),
      });
      const data = await resp.json();
      if (data && (data.data?.authorization_url || data.authorization_url)) {
        const url = data.data?.authorization_url || data.authorization_url;
        toast({ title: 'Redirecting', description: 'Redirecting to Paystack...', variant: 'default' });
        // small delay to allow toast to show briefly
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
        <h2 className="text-xl font-bold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-2">Username: {user.username}</p>
        <p className="text-sm text-muted-foreground">Email: {user.email || '—'}</p>
        <p className="text-sm text-muted-foreground">Role: {user.role}</p>
        
        {/* Email Update Section */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold mb-2">Update Email</h3>
          <p className="text-xs text-muted-foreground mb-3">A valid email is required for Paystack payments</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={updateEmail} disabled={isSavingEmail || !email}>
              {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
        
        {user.role === 'agent' && (
            <div className="mt-6 pt-6 border-t">
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
