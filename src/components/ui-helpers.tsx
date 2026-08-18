import { cn } from "@/lib/utils";
import {
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Coins,
  Settings2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconClassName,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-full", iconClassName || "bg-blue-100 text-blue-600")}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-violet-700 dark:text-violet-400">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  tone?: "green" | "purple" | "orange" | "magenta" | "blue" | "teal" | "pink";
}) {
  const tones: Record<string, string> = {
    green: "from-emerald-50 to-emerald-100/60 text-emerald-700",
    purple: "from-violet-50 to-violet-100/60 text-violet-700",
    orange: "from-orange-50 to-orange-100/60 text-orange-700",
    magenta: "from-fuchsia-50 to-fuchsia-100/60 text-fuchsia-700",
    blue: "from-blue-50 to-blue-100/60 text-blue-700",
    teal: "from-teal-50 to-teal-100/60 text-teal-700",
    pink: "from-pink-50 to-pink-100/60 text-pink-700",
  };
  const iconBg: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-600",
    purple: "bg-violet-500/15 text-violet-600",
    orange: "bg-orange-500/15 text-orange-600",
    magenta: "bg-fuchsia-500/15 text-fuchsia-600",
    blue: "bg-blue-500/15 text-blue-600",
    teal: "bg-teal-500/15 text-teal-600",
    pink: "bg-pink-500/15 text-pink-600",
  };

  return (
    <div className={cn("rounded-2xl border border-white/60 bg-gradient-to-br p-5 shadow-sm", tones[tone])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {typeof change === "number" && (
        <div className={cn("mt-3 flex items-center gap-1 text-xs font-medium", change >= 0 ? "text-emerald-600" : "text-rose-600")}>
          {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(change)}% from last month
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600", iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.trim();

  const map: Record<string, string> = {
    Pending: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-200 dark:border-sky-800/80",
    Processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80",
    Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80",
    Canceled: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80",
    Credited: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    Refunded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    Refund: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    Failed: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    credited: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80",
    canceled: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80",
    refund: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    refunded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80",
    pending: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-200 dark:border-sky-800/80",
    processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80",
  };

  const statusKey = normalized.toLowerCase();
  const classes = map[normalized] || map[statusKey] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700";

  let Icon: LucideIcon = Clock3;
  let iconClassName = "h-3 w-3 animate-spin";

  if (statusKey === "pending") {
    Icon = Clock3;
    iconClassName = "h-3 w-3 animate-spin";
  } else if (statusKey === "processing") {
    Icon = Settings2;
    iconClassName = "h-3 w-3 animate-spin";
  } else if (statusKey === "cancelled" || statusKey === "canceled") {
    Icon = BadgeDollarSign;
    iconClassName = "h-3 w-3";
  } else if (statusKey === "refunded" || statusKey === "refund") {
    Icon = Coins;
    iconClassName = "h-3 w-3 animate-bounce";
  } else if (statusKey === "completed" || statusKey === "credited" || statusKey === "approved") {
    Icon = CheckCircle2;
    iconClassName = "h-3 w-3";
  } else if (statusKey === "failed") {
    Icon = BadgeDollarSign;
    iconClassName = "h-3 w-3";
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", classes)}>
      <Icon className={iconClassName} />
      {status}
    </span>
  );
}

export function WalletPill({ balance }: { balance: number }) {
  return (
    <div className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
      Wallet: GHS {balance.toFixed(2)}
    </div>
  );
}
