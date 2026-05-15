import { useState } from "react";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import LixenLogo from "@/components/lixen-logo";

export default function Login() {
  const { setToken, devFallback } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/status", {
        headers: { Authorization: `Bearer ${value.trim()}` },
      });
      if (!res.ok) {
        setError("Token rejected. Check that you pasted the Lixen operator token.");
        setBusy(false);
        return;
      }
      // Set on window synchronously so first queries pick it up,
      // then update React state which renders the protected shell.
      (window as any).__LIXEN_TOKEN__ = value.trim();
      setToken(value.trim());
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <LixenLogo className="h-10 w-auto text-[hsl(217_80%_24%)]" />
        </div>
        <Card className="shadow-lg border-card-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <Lock className="w-5 h-5" />
              Operator sign-in
            </CardTitle>
            <CardDescription>
              Enter your Lixen operator token to unlock the Prospecting Agent OS dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground" htmlFor="operator-token">
                  Operator token
                </label>
                <Input
                  id="operator-token"
                  data-testid="input-operator-token"
                  type="password"
                  placeholder="Paste operator token"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-sm text-destructive flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                type="submit"
                disabled={busy || !value.trim()}
                className="w-full"
                data-testid="button-unlock"
              >
                {busy ? "Checking…" : "Unlock dashboard"}
              </Button>
            </form>
            <div className="mt-6 rounded-md bg-secondary border border-secondary-border p-3 text-xs leading-relaxed">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-[hsl(211_70%_39%)] shrink-0" />
                <div>
                  <div className="font-semibold text-[hsl(217_80%_24%)] mb-1">
                    Only the Lixen operator token belongs here
                  </div>
                  <p className="text-muted-foreground">
                    Never paste a HighLevel Private Integration token, API key, or any
                    third-party credential into this login. The operator token only unlocks this
                    internal dashboard.
                  </p>
                </div>
              </div>
            </div>
            {devFallback && (
              <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Dev fallback active: <code className="font-mono">OPERATOR_TOKEN</code> is not
                configured. Use <code className="font-mono">lixen-prospecting-dev</code> to sign in
                locally. Set a real token before deploying.
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Lixen Prospecting Agent OS · Internal command center
        </p>
      </div>
    </div>
  );
}
