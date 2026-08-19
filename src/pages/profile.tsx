import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Mail,
  Phone,
  Share2,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui-helpers";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { formatGHS } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [momo, setMomo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone);
    setWhatsapp(user.whatsapp || "");
    setMomo(user.momo || "");
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Sign in to view your profile.
      </div>
    );
  }

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${user.referralCode}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(user.referralCode);
      toast({ title: "Copied", description: "Referral code copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: user.referralCode, variant: "destructive" });
    }
  };

  const shareReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast({ title: "Link copied", description: "Share your referral link with new dealers." });
    } catch {
      toast({ title: "Referral link", description: referralLink });
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUser({
        fullName,
        email,
        phone,
        whatsapp: whatsapp || undefined,
        momo: momo || undefined,
        initials: fullName
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    logout();
    toast({
      title: "Account deleted",
      description: "Your local session was cleared. Contact support to remove server data.",
      variant: "destructive",
    });
  };

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Manage your dealer details, verification, and referral program."
        icon={UserRound}
        iconClassName="bg-violet-100 text-violet-600"
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <div className="relative mx-auto inline-block">
              <Avatar className="h-24 w-24 border-4 border-violet-100">
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-2 ring-white">
                <BadgeCheck className="h-4 w-4" />
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{user.fullName}</h2>
            <Badge className="mt-2 border-transparent bg-violet-100 text-violet-700 hover:bg-violet-100">
              Dealer
            </Badge>

            <div className="mt-5 space-y-2 text-left">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {user.email}
                </span>
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {user.phone}
                </span>
                {user.phoneVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-emerald-700/80">Wallet Balance</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{formatGHS(user.walletBalance)}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 shadow-sm">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600">
                <Share2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-violet-700/80">Commission</p>
              <p className="mt-1 text-xl font-bold text-violet-700">{formatGHS(user.commissionEarned)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">Network</span>
              <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
                {user.network}
              </Badge>
              <span className="text-sm text-slate-500">Status</span>
              <StatusBadge status={user.status} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-violet-700">Referral Program</h3>
            <p className="mt-1 text-sm text-slate-500">Share your code and earn on referred dealers.</p>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 rounded-xl border border-dashed border-violet-200 bg-violet-50 px-3 py-2.5 font-mono text-lg font-bold tracking-widest text-violet-700">
                {user.referralCode}
              </div>
              <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Total referrals: <span className="font-bold text-slate-900">{user.totalReferrals}</span>
            </p>

            <Button
              type="button"
              onClick={shareReferral}
              className="mt-4 w-full gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
            >
              <Share2 className="h-4 w-4" />
              Share Referral Link
            </Button>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5 lg:col-span-3">
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-5 text-lg font-semibold text-violet-700">Edit Profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">
                  WhatsApp <span className="text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="054XXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="momo">MoMo</Label>
                <Input
                  id="momo"
                  value={momo}
                  onChange={(e) => setMomo(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="Mobile money number"
                />
              </div>
            </div>
            <Button
              type="submit"
              processing={isSaving}
              className="mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md hover:from-blue-700 hover:to-violet-700"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </form>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-violet-700">Account Verification</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Email verified
                </div>
                <p className="mt-1 text-sm text-emerald-700/80">
                  {user.emailVerified ? "Your email is confirmed." : "Please verify your email."}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Phone verified
                </div>
                <p className="mt-1 text-sm text-emerald-700/80">
                  {user.phoneVerified ? "Your phone is confirmed." : "Please verify your phone."}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 sm:col-span-2">
                <div className="flex items-center gap-2 font-semibold text-violet-800">
                  <BadgeCheck className="h-4 w-4" />
                  Dealer approval
                </div>
                <p className="mt-1 text-sm text-violet-700/80">
                  Account status is <span className="font-semibold capitalize">{user.status}</span>. You can place
                  orders and fund your wallet.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-violet-700">Account Actions</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() =>
                  toast({
                    title: "Preferences",
                    description: "Notification and display preferences will open here.",
                  })
                }
              >
                Edit Preferences
              </Button>
              <a href="https://wa.me/233592786175" target="_blank" rel="noreferrer">
                <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto">
                  Contact Support
                </Button>
              </a>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will sign you out and clear your local session. This action cannot be undone from
                      this panel.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
