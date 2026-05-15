import { useEffect, useState, createContext, useContext } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AppShell from "@/components/app-shell";
import Dashboard from "@/pages/dashboard";
import Autopilot from "@/pages/autopilot";
import CallOutreach from "@/pages/call-outreach";
import LeadRouting from "@/pages/lead-routing";
import GhlPipeline from "@/pages/ghl-pipeline";
import AvaVoice from "@/pages/ava-voice";
import Integrations from "@/pages/integrations";
import AuditLog from "@/pages/audit-log";
import Sop from "@/pages/sop";

type AuthCtx = {
  token: string | null;
  setToken: (t: string | null) => void;
  devFallback: boolean;
};
const AuthContext = createContext<AuthCtx>({
  token: null,
  setToken: () => {},
  devFallback: false,
});
export const useAuth = () => useContext(AuthContext);

function ProtectedRoutes() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/autopilot" component={Autopilot} />
        <Route path="/calls" component={CallOutreach} />
        <Route path="/routing" component={LeadRouting} />
        <Route path="/ghl" component={GhlPipeline} />
        <Route path="/ava" component={AvaVoice} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/sop" component={Sop} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [devFallback, setDevFallback] = useState(false);

  // Update the global request header function used by queryClient
  useEffect(() => {
    (window as any).__LIXEN_TOKEN__ = token;
  }, [token]);

  // Detect dev fallback (public, no token)
  useEffect(() => {
    fetch("/api/public/auth-info")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.devFallback) setDevFallback(true); })
      .catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ token, setToken, devFallback }}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            {token ? <ProtectedRoutes /> : <Login />}
          </Router>
        </TooltipProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
