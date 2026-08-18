import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  ShoppingCart,
  PanelLeftClose,
  PanelLeft,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import type { NotificationItem } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function TopNavbar({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
    fetch(`${apiBase}/api/notifications`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.notifications)) setNotifications(data.notifications);
      })
      .catch(() => undefined);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-9 w-9 text-slate-500 hover:text-slate-800"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      <div className="flex items-center gap-1.5">
        <Link href="/user/cart">
          <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-500 dark:text-slate-300">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-500 dark:text-slate-300">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 dark:border-slate-700 dark:bg-slate-900">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span className="dark:text-slate-100">Notifications</span>
              {unread > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-[11px] text-violet-600 dark:text-violet-300"
                  onClick={() => setNotifications([])}
                >
                  Mark as read
                </Button>
              ) : (
                <Badge variant="secondary" className="dark:bg-slate-800 dark:text-slate-200">All read</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-3 dark:text-slate-200">
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-[11px] text-muted-foreground">{n.time}</span>
                  </div>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">{n.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-violet-500">
              <Avatar className="h-9 w-9 border border-violet-100">
                <AvatarFallback className="bg-fuchsia-500 text-white text-sm font-semibold">
                  {user?.initials || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user?.fullName}</span>
                <span className="text-xs font-normal text-muted-foreground capitalize">
                  {user?.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/user/profile")}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                logout();
                setLocation("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
