import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Wallet,
  FileText,
  Ticket,
  Users,
  PlayCircle,
  History,
  BookOpen,
  KeyRound,
  Settings,
  ChevronDown,
  Grid3X3,
  CircleDot,
  Radio,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  activeClass?: string;
}

const mainLinks: NavLink[] = [
  { label: "Dashboard", href: "/user/dashboard", icon: LayoutDashboard, iconClass: "text-blue-600", activeClass: "bg-blue-50 text-blue-700 border-l-blue-600" },
  { label: "Wallet", href: "/user/wallet", icon: Wallet, iconClass: "text-emerald-600", activeClass: "bg-emerald-50 text-emerald-700 border-l-emerald-600" },
];

const networkLinks: NavLink[] = [
  { label: "MTN", href: "/user/mtn", icon: Grid3X3, iconClass: "text-amber-500", activeClass: "bg-amber-50 text-amber-800 border-l-amber-500" },
  { label: "AirtelTigo", href: "/user/airteltigo", icon: CircleDot, iconClass: "text-rose-500", activeClass: "bg-rose-50 text-rose-700 border-l-rose-500" },
  { label: "Telecel", href: "/user/telecel", icon: Radio, iconClass: "text-red-600", activeClass: "bg-red-50 text-red-700 border-l-red-600" },
];

const extraLinks: NavLink[] = [
  { label: "AFA Registration", href: "/user/afa", icon: FileText, iconClass: "text-orange-500", activeClass: "bg-orange-50 text-orange-700 border-l-orange-500" },
  { label: "Vouchers Shop", href: "/user/vouchers", icon: Ticket, iconClass: "text-violet-600", activeClass: "bg-violet-50 text-violet-700 border-l-violet-600" },
  { label: "My Referrals", href: "/user/referrals", icon: Users, iconClass: "text-green-600", activeClass: "bg-green-50 text-green-700 border-l-green-600" },
  { label: "Services & Offers", href: "/user/services", icon: PlayCircle, iconClass: "text-pink-500", activeClass: "bg-pink-50 text-pink-700 border-l-pink-500" },
];

const historyLinks: NavLink[] = [
  { label: "MTN Orders", href: "/user/history/mtn", icon: History },
  { label: "AT Orders", href: "/user/history/at", icon: History },
  { label: "Telecel Orders", href: "/user/history/telecel", icon: History },
  { label: "All Orders", href: "/user/history/orders", icon: History },
  { label: "Refunds", href: "/user/history/refunds", icon: History },
  { label: "Deposits", href: "/user/history/deposits", icon: History },
  { label: "AFA Registrations", href: "/user/history/afa", icon: History },
  { label: "Voucher Purchases", href: "/user/history/vouchers", icon: History },
];

const devLinks: NavLink[] = [
  { label: "API Docs", href: "/user/api-docs", icon: BookOpen },
  { label: "API Keys", href: "/user/api-keys", icon: KeyRound },
  { label: "Settings", href: "/user/settings", icon: Settings },
];

const adminLinks: NavLink[] = [
  { label: "Admin Overview", href: "/admin", icon: Shield, iconClass: "text-violet-600", activeClass: "bg-violet-50 text-violet-700 border-l-violet-600" },
  { label: "Users", href: "/user/dashboard", icon: Users, iconClass: "text-sky-600", activeClass: "bg-sky-50 text-sky-700 border-l-sky-600" },
  { label: "Settings", href: "/user/settings", icon: Settings, iconClass: "text-slate-600", activeClass: "bg-slate-100 text-slate-700 border-l-slate-600" },
];

function NavItem({
  item,
  active,
  onClick,
  nested,
}: {
  item: NavLink;
  active: boolean;
  onClick?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors border-l-2 border-transparent",
        nested && "pl-8 text-[13px]",
        active
          ? item.activeClass || "bg-slate-100 text-slate-900 border-l-blue-600 dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", item.iconClass || "text-slate-500 dark:text-slate-400")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === "admin";
  const visibleLinks = isAdmin ? adminLinks : [...mainLinks, ...networkLinks, ...extraLinks, ...devLinks];
  const historyOpenDefault = location.startsWith("/user/history");
  const [historyOpen, setHistoryOpen] = useState(historyOpenDefault);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 bg-white py-4 border-r border-slate-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          U
        </div>
        {visibleLinks.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                active ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Icon className={cn("h-4 w-4", item.iconClass)} />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-sm">
          U
        </div>
        <div>
          <p className="text-[15px] font-semibold text-slate-800 leading-tight dark:text-slate-100">AllenDataHub</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Dealer Portal</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {isAdmin ? (
          <div className="space-y-0.5">
            {adminLinks.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={location === item.href}
                onClick={onNavigate}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              {mainLinks.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={location === item.href}
                  onClick={onNavigate}
                />
              ))}
            </div>

            <div className="space-y-0.5">
              {networkLinks.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={location === item.href}
                  onClick={onNavigate}
                />
              ))}
            </div>

            <div className="space-y-0.5">
              {extraLinks.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={location === item.href}
                  onClick={onNavigate}
                />
              ))}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  historyOpenDefault
                    ? "bg-teal-50 text-teal-700 dark:bg-slate-800 dark:text-teal-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <History className="h-4 w-4 text-teal-600" />
                <span className="flex-1 text-left">History</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-slate-400 transition-transform dark:text-slate-500", historyOpen && "rotate-180")}
                />
              </button>
              {historyOpen && (
                <div className="mt-1 space-y-0.5">
                  {historyLinks.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      nested
                      active={location === item.href}
                      onClick={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3 space-y-0.5 dark:border-slate-800">
        {!isAdmin && devLinks.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={location === item.href}
            onClick={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
