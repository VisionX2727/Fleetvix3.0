import { Link, useLocation } from "wouter";
import { 
  Home, 
  Truck, 
  ClipboardList, 
  BookOpen, 
  BarChart3,
  Calculator,
  Droplet,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { useRole } from "@/lib/role";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

function detectMobileDevice() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;

  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
  // iPadOS can identify itself as macOS Safari, so preserve its mobile
  // behavior without treating touchscreen Windows laptops as phones.
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return mobileUserAgent || ipadOs;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [creditOpen, setCreditOpen] = useState(false);
  const mobileDevice = detectMobileDevice();
  const { role } = useRole();
  const { syncStatus, retrySync } = useStore();

  const navItems = role === "driver"
    ? [
        { path: "/", icon: Home, label: "Home" },
        { path: "/logs", icon: ClipboardList, label: "Logs" },
        { path: "/fuel", icon: Droplet, label: "Fuel" },
        { path: "/fleetu", icon: Sparkles, label: "Fleetu" },
        { path: "/invoices", icon: ReceiptText, label: "Invoices & Files" },
      ]
    : [
        { path: "/", icon: Home, label: "Home" },
        { path: "/fleet", icon: Truck, label: "Fleet" },
        { path: "/logs", icon: ClipboardList, label: "Logs" },
        { path: "/fleetu", icon: Sparkles, label: "Fleetu" },
        { path: "/analytics", icon: BarChart3, label: "Analytics" },
        { path: "/khata", icon: BookOpen, label: "Khata" },
      ];
  const hideBottomNav = location === "/settings" || location === "/drivers";

  return (
    <div className="fm-app-shell" data-device={mobileDevice ? "mobile" : "desktop"}>
      {syncStatus === "error" && (
        <div role="alert" className="fixed inset-x-3 top-3 z-50 flex items-center gap-3 rounded-xl border border-rose-400/40 bg-[#321c23] p-3 text-xs font-bold text-rose-100 shadow-lg">
          <span className="min-w-0 flex-1">Cloud save failed. Your latest changes are still on this device.</span>
          <button type="button" onClick={retrySync} className="shrink-0 rounded-lg bg-rose-300 px-3 py-2 text-xs font-black text-rose-950">Retry</button>
        </div>
      )}
      <main className="fm-main-content">
        {children}
      </main>

      {!hideBottomNav && <nav className="fm-bottom-nav">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} className={`fm-bottom-item ${isActive ? "is-active" : ""}`}>
                <item.icon size={23} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>}
       <Link href="/settings" className="sr-only">Settings</Link>
       <Link href="/calculator" className="sr-only">Calculator</Link>
       <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
         <DialogContent className="w-[88vw] max-w-sm rounded-2xl">
           <DialogHeader><DialogTitle>About Fleetvix</DialogTitle></DialogHeader>
           <div className="space-y-3 pt-2 text-center">
             <p className="text-lg font-black">App made by Mandar Patil</p>
             <p className="text-sm text-muted-foreground">Fleetvix helps owners and drivers manage vehicles, work, payments and records.</p>
           </div>
         </DialogContent>
       </Dialog>
       <button type="button" onClick={() => setCreditOpen(true)} className="fixed bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground opacity-45 transition-opacity hover:opacity-100">App made by Mandar Patil</button>
    </div>
  );
}
