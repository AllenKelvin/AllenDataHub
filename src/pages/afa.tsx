import { useState, type FormEvent } from "react";
import { FileText, Send } from "lucide-react";
import { PageHeader } from "@/components/ui-helpers";
import { useAuth } from "@/lib/auth";
import { formatGHS } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function AfaPage() {
  const { toast } = useToast();
  const { user, debitWallet } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("ghana-card");
  const [idNumber, setIdNumber] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !idNumber.trim()) {
      toast({
        title: "Missing details",
        description: "Full name, phone, and ID number are required.",
        variant: "destructive",
      });
      return;
    }
    if (!user) {
      toast({ title: "Please sign in", description: "You must be logged in to submit an AFA registration.", variant: "destructive" });
      return;
    }

    const fee = 20;
    if (user.walletBalance < fee) {
      toast({ title: "Insufficient wallet balance", description: `Your wallet balance is ${formatGHS(user.walletBalance)}.`, variant: "destructive" });
      return;
    }

    const success = debitWallet(fee);
    if (!success) {
      toast({ title: "Payment failed", description: "Unable to debit your wallet. Please try again.", variant: "destructive" });
      return;
    }

    toast({
      title: "Registration submitted",
      description: `AFA request for ${fullName} (${phone}) is pending review. Submitted fee: ${formatGHS(fee)}.`,
    });
    setFullName("");
    setPhone("");
    setIdNumber("");
    setRegion("");
    setNotes("");
  };

  return (
    <div>
      <PageHeader
        title="AFA Registration"
        description="Register a new AFA beneficiary. Submissions are reviewed before activation."
        icon={FileText}
        iconClassName="bg-orange-100 text-orange-600"
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <h2 className="text-lg font-semibold text-violet-700">Beneficiary details</h2>
            <p className="text-sm text-slate-500">Provide accurate ID information for verification.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="afa-name">Full name</Label>
              <Input
                id="afa-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As on Ghana Card"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-phone">Phone number</Label>
              <Input
                id="afa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024XXXXXXX"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>ID type</Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ghana-card">Ghana Card</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="voters">Voter ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-id">ID number</Label>
              <Input
                id="afa-id"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="GHA-XXXXXXXX-X"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-region">Region</Label>
              <Input
                id="afa-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Greater Accra"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="afa-notes">Notes (optional)</Label>
              <Textarea
                id="afa-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra context for the review team…"
                className="min-h-[100px] rounded-xl"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
          >
            <Send className="h-4 w-4" />
            Submit Registration - {formatGHS(20)}
          </Button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm">
            <h3 className="font-semibold text-orange-800">What happens next?</h3>
            <ul className="mt-3 space-y-2 text-sm text-orange-900/80">
              <li>1. We validate the ID details you submitted.</li>
              <li>2. Status updates appear under History → AFA.</li>
              <li>3. Approved beneficiaries can receive AFA services.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-violet-700">Requirements</h3>
            <p className="mt-2 text-sm text-slate-500">
              Ensure the phone number matches the network used for AFA. Incomplete forms are rejected
              automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
