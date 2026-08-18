import { useState } from "react";
import { Bell, Moon, Settings, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [depositAlerts, setDepositAlerts] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [compactTables, setCompactTables] = useState(false);
  const [timezone, setTimezone] = useState("Africa/Accra");
  const [currency, setCurrency] = useState("GHS");

  const save = () => {
    toast({
      title: "Preferences saved",
      description: "Your notification and display settings have been updated.",
    });
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage notifications, display preferences, and regional defaults."
        icon={Settings}
        iconClassName="bg-slate-100 text-slate-700"
        actions={
          <Button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
          >
            Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-violet-700">Notifications</h2>
              <p className="text-sm text-slate-500">Choose how you hear about account activity.</p>
            </div>
          </div>

          <div className="space-y-5">
            <PrefRow
              label="Email alerts"
              description="Receive important account emails"
              checked={emailAlerts}
              onCheckedChange={setEmailAlerts}
            />
            <PrefRow
              label="SMS alerts"
              description="Text messages for high-priority events"
              checked={smsAlerts}
              onCheckedChange={setSmsAlerts}
            />
            <PrefRow
              label="Order updates"
              description="Pending, processing, and completed orders"
              checked={orderUpdates}
              onCheckedChange={setOrderUpdates}
            />
            <PrefRow
              label="Deposit alerts"
              description="Notify when wallet top-ups are credited"
              checked={depositAlerts}
              onCheckedChange={setDepositAlerts}
            />
            <PrefRow
              label="Marketing & offers"
              description="Occasional product and promo updates"
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-violet-700">Display</h2>
              <p className="text-sm text-slate-500">Tune how the portal looks on your devices.</p>
            </div>
          </div>

          <div className="space-y-5">
            <PrefRow
              label="Dark mode preference"
              description="Remember dark theme across sessions"
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
            <PrefRow
              label="Compact tables"
              description="Tighter row spacing on history pages"
              checked={compactTables}
              onCheckedChange={setCompactTables}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-violet-700">Regional</h2>
              <p className="text-sm text-slate-500">Defaults used for dates, amounts, and reports.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Accra">Africa/Accra (GMT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency display</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">GHS (₵)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={save}
            className="mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
          >
            Save preferences
          </Button>
        </section>
      </div>
    </div>
  );
}

function PrefRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
