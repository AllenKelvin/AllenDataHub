import { useState } from "react";
import { Download, MessageCircle } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const WHATSAPP_URL = "https://wa.me/233592786175";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 transition-all duration-200",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-72 shadow-2xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNavbar
          collapsed={collapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(true);
            } else {
              setCollapsed((v) => !v);
            }
          }}
        />
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 md:p-6">{children}</div>
        </main>
      </div>

      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-3">
        {!isMobile && (
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
            title="Export / Download"
            onClick={() => window.print()}
          >
            <Download className="h-5 w-5" />
          </button>
        )}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600"
          title="WhatsApp Support"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
