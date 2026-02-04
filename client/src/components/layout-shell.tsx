import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useCartContext } from "@/context/CartContext";
import { 
  LogOut, 
  LayoutDashboard, 
  ShoppingBag, 
  Settings, 
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useState as useStateLocal } from "react";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const { data: cart = [] } = useCart();
  const { cartItems } = useCartContext();
  const { mutate: logout } = useLogout();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // If no user (and not loading), we assume the page might redirect or show restricted view
  // But purely for layout, if no user, render children directly (e.g. auth pages)
  if (!user) return <>{children}</>;

  const totalContextItems = cartItems.length;  // Each context item is 1 added package
  const cartCount = (cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0) + totalContextItems;

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <div 
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer mb-1",
            isActive 
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <Icon className="w-5 h-5" />
          <span className="font-medium">{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header: menu left, cart top right near menu area */}
      <div className="md:hidden bg-white border-b border-border p-4 flex justify-between items-center sticky top-0 z-50">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Menu">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
        <h1 className="text-xl font-bold font-display text-primary">AllenDataHub</h1>
        {/* Cart icon removed from mobile header to avoid duplicate */}
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-border flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <h1 className="text-2xl font-bold font-display text-primary tracking-tight">
            Allen<span className="text-accent">Data</span>Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">PREMIUM DATA SERVICES</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/buy-data" icon={ShoppingBag} label="Buy Data" />
          
          {user.role === 'admin' && (
            <>
              <div className="px-4 pt-6 pb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Administration</p>
              </div>
              <NavItem href="/admin" icon={ShieldCheck} label="Admin Portal" />
            </>
          )}

          {user.role === 'agent' && (
            <div className="mt-8 mx-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <p className="text-xs font-bold text-accent-foreground mb-1">Agent Status</p>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", user.isVerified ? "bg-green-500" : "bg-yellow-500")} />
                <span className="text-sm font-medium">{user.isVerified ? "Verified" : "Pending"}</span>
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border bg-gray-50/50">
          <div className="flex items-center gap-3 px-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen">
        <div className="w-full bg-white border-b border-border">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex items-center justify-between gap-4">
            {/* Left: Agent wallet only */}
            {user.role === 'agent' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-xs font-medium text-muted-foreground">Wallet:</span>
                <span className="font-bold text-primary">GHS {user.balance?.toFixed(2) || '0.00'}</span>
              </div>
            )}
            {user.role !== 'agent' && <div className="flex-1" />}

            {/* Top right: Cart + User menu (user and admin pages) */}
            <div className="flex items-center gap-4 ml-auto">
              <Link href="/cart">
                <button aria-label="Cart" className="relative p-2 rounded-md hover:bg-gray-100">
                  <ShoppingBag className="w-6 h-6" />
                  {cartCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </button>
              </Link>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="flex items-center gap-2 p-1 rounded-md"
                  aria-label="User menu"
                >
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-border rounded-md shadow-md z-50">
                      <Link href="/profile">
                        <div className="px-4 py-2 hover:bg-gray-50">Profile</div>
                      </Link>
                      {user.role === 'agent' && (
                        <Link href="/fund-wallet">
                          <div className="px-4 py-2 hover:bg-gray-50">Fund Wallet</div>
                        </Link>
                      )}
                      <div
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => logout()}
                      >
                        Logout
                      </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 animate-in fade-in duration-500">
          {children}
        </div>
      </main>

      {/* Floating chat CTA (small icon with popup) */}
      <FloatingChat />

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

function FloatingChat() {
  const [open, setOpen] = useStateLocal(false);
  return (
    <div className="fixed right-6 bottom-6 z-50">
      <button
        aria-label="Open chat"
        onClick={() => setOpen((s) => !s)}
        className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl"
      >
        💬
      </button>
      {open && (
        <div className="mt-2 w-64 p-3 bg-white border border-border rounded-lg shadow-lg">
          <div className="font-semibold">Chat Admin</div>
          <div className="text-xs text-muted-foreground mb-2">We are available 8am–10pm</div>
          <a href="https://wa.me/qr/KFPAZ35ZMR3XG1" target="_blank" rel="noreferrer" className="block text-sm text-green-600">Chat (quick link)</a>
          <a href="https://chat.whatsapp.com/JaqjPu6Yhp453JVtKeII2z" target="_blank" rel="noreferrer" className="block text-sm mt-1 text-muted-foreground underline">Join Community</a>
        </div>
      )}
    </div>
  );
}
