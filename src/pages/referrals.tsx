import { Copy, Share2, Users } from "lucide-react";
import { MetricCard, PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { formatGHS } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

export default function ReferralsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const code = user?.referralCode || "DMRMMC";
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${code}`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: label, description: value });
    }
  };

  return (
    <div>
      <PageHeader
        title="My Referrals"
        description="Share your code, invite dealers, and track referral earnings."
        icon={Users}
        iconClassName="bg-emerald-100 text-emerald-600"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Referral Code"
          value={code}
          icon={Copy}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Total Referrals"
          value={user?.totalReferrals ?? 0}
          icon={Users}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Commission Earned"
          value={formatGHS(user?.commissionEarned ?? 0)}
          icon={Share2}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Pending Payouts"
          value={formatGHS(0)}
          icon={Users}
          iconClassName="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-violet-700">Your referral code</h2>
          <p className="mt-1 text-sm text-slate-500">
            Friends who register with this code are linked to your account.
          </p>
          <div className="mt-4 flex gap-2">
            <Input value={code} readOnly className="rounded-xl font-mono text-lg tracking-widest" />
            <Button
              className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => copy(code, "Referral code")}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-violet-700">Invite link</h2>
          <p className="mt-1 text-sm text-slate-500">Share this link on WhatsApp or social media.</p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="ref-link">Registration link</Label>
            <div className="flex gap-2">
              <Input id="ref-link" value={link} readOnly className="rounded-xl text-sm" />
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => copy(link, "Invite link")}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Users className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-lg font-semibold text-slate-800 dark:text-slate-100">No referrals yet</h3>
        <p className="mt-2 text-sm text-slate-500">
          When someone signs up with your code, they will appear in this list.
        </p>
      </div>
    </div>
  );
}
