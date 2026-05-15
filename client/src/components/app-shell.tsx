import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/App";
import LixenLogo from "@/components/lixen-logo";
import {
  LayoutDashboard,
  Activity,
  PhoneCall,
  Route as RouteIcon,
  GitBranch,
  Mic,
  Plug,
  ScrollText,
  BookOpen,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/autopilot", label: "Autopilot Monitor", icon: Activity },
  { href: "/calls", label: "Call Outreach", icon: PhoneCall },
  { href: "/routing", label: "Lead Routing", icon: RouteIcon },
  { href: "/ghl", label: "GHL Pipeline", icon: GitBranch },
  { href: "/ava", label: "Ava Voice AI", icon: Mic },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/sop", label: "SOP", icon: BookOpen },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { setToken, devFallback } = useAuth();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
          <LixenLogo className="h-8 w-auto text-white" />
          <div className="mt-1 text-[11px] uppercase tracking-wider text-white/60">
            Prospecting Agent OS
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-white font-medium"
                    : "text-white/80 hover:bg-sidebar-accent hover:text-white",
                ].join(" ")}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/80 hover:text-white hover:bg-sidebar-accent"
            onClick={() => { (window as any).__LIXEN_TOKEN__ = null; setToken(null); }}
            data-testid="button-lock"
          >
            <Lock className="w-4 h-4 mr-2" />
            Lock
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {devFallback && (
          <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-xs px-6 py-2">
            Dev fallback token in use — set <code>OPERATOR_TOKEN</code> before deploying to production.
          </div>
        )}
        <div className="px-8 py-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
