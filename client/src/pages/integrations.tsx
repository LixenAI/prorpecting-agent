import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";

type IntStatus = {
  devFallback: boolean;
  configured: Record<string, boolean>;
  values: Record<string, string>;
  scheduledQaBrief: { name: string; cron: string; timezone: string };
  pipelineWatch?: {
    dataMode: "live" | "fallback" | "error";
    status: number;
    classification: string;
    pipelineName?: string;
    pipelinesCount?: number;
  };
};

function pipelineBadgeTone(mode?: "live" | "fallback" | "error"): "ok" | "warn" | "block" {
  if (mode === "live") return "ok";
  if (mode === "error") return "block";
  return "warn";
}

function pipelineBadgeLabel(mode?: "live" | "fallback" | "error"): string {
  if (mode === "live") return "Live GHL Data";
  if (mode === "error") return "GHL Error";
  return "Demo Fallback";
}

type TestResult = {
  ok: boolean;
  highLevelStatus?: number;
  classification: string;
  pipelinesFound?: number;
  pipelineFound?: boolean;
  nextSteps: string[];
};

export default function Integrations() {
  const { data } = useQuery<IntStatus>({ queryKey: ["/api/integrations/status"] });
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [smokeResult, setSmokeResult] = useState<any>(null);

  const testGhl = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/integrations/test-ghl-token", {
        token: tokenInput.trim(),
        locationId: data?.values.GHL_LOCATION_ID,
      });
      return (await r.json()) as TestResult;
    },
    onSuccess: (r) => { setResult(r); setTokenInput(""); },
    onError: (err: any) => setResult({ ok: false, classification: "network_error", nextSteps: [String(err?.message || err)] }),
  });

  const testRoute = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/routing/smoke-test", { scenario: "hot" });
      return await r.json();
    },
    onSuccess: setSmokeResult,
  });

  const envBlock = `OPERATOR_TOKEN=<set a long random operator token>
GHL_LOCATION_ID=${data?.values.GHL_LOCATION_ID ?? "C7e7ReTQ4FXMZp9TjxzU"}
GHL_PRIVATE_INTEGRATION_TOKEN=<paste HighLevel Private Integration token>
GHL_API_BASE_URL=${data?.values.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com"}
GHL_API_VERSION=${data?.values.GHL_API_VERSION ?? "2021-07-28"}
GHL_OPPORTUNITIES_API_VERSION=${data?.values.GHL_OPPORTUNITIES_API_VERSION ?? "2023-02-21"}
LIXEN_PROSPECTING_AGENT_NAME=${data?.values.LIXEN_PROSPECTING_AGENT_NAME ?? "LixenAI Prospecting Agent"}
LIXEN_VOICE_AGENT_NAME=${data?.values.LIXEN_VOICE_AGENT_NAME ?? "Ava — Med Spa Prospecting Agent"}
ROUTE_PROSPECT_API_URL=${data?.values.ROUTE_PROSPECT_API_URL ?? "https://prorpecting-agent.vercel.app/api/route-prospect"}
LIXEN_BOOKING_LINK=${data?.values.LIXEN_BOOKING_LINK ?? "https://link.lixen.ai/widget/booking/W0BVrWmszScBAjQhN631"}
PROSPECTING_CUSTOM_DOMAIN=${data?.values.PROSPECTING_CUSTOM_DOMAIN ?? "prospecting-agent.lixenai.com"}`;

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Operator vs HighLevel tokens, environment variables, and safe diagnostics. Tokens are never stored, logged, or returned."
      />

      <Card className="mb-6 bg-[hsl(211_60%_95%)] border-[hsl(211_70%_85%)]">
        <CardContent className="py-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-[hsl(211_70%_39%)]" />
              <div>
                <div className="font-semibold text-[hsl(217_80%_24%)]">Operator token</div>
                <p className="text-muted-foreground text-xs">
                  Unlocks this dashboard only. Set via <code className="font-mono">OPERATOR_TOKEN</code>. Never paste this into HighLevel.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 mt-0.5 text-[hsl(211_70%_39%)]" />
              <div>
                <div className="font-semibold text-[hsl(217_80%_24%)]">GHL Private Integration token</div>
                <p className="text-muted-foreground text-xs">
                  Read-only HighLevel API access. Set via <code className="font-mono">GHL_PRIVATE_INTEGRATION_TOKEN</code>. Never paste this into the login.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(data?.configured ?? {}).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="py-3">
              <div className="text-[11px] font-mono text-muted-foreground break-all">{k}</div>
              <div className="mt-1">
                <StatusBadge tone={v ? "ok" : "warn"}>{v ? "configured" : "missing"}</StatusBadge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">Live pipeline watch</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={pipelineBadgeTone(data?.pipelineWatch?.dataMode)}>
              {pipelineBadgeLabel(data?.pipelineWatch?.dataMode)}
            </StatusBadge>
            <StatusBadge tone={data?.configured?.GHL_PRIVATE_INTEGRATION_TOKEN ? "ok" : "warn"}>
              token {data?.configured?.GHL_PRIVATE_INTEGRATION_TOKEN ? "configured" : "missing"}
            </StatusBadge>
            {data?.pipelineWatch?.pipelineName && (
              <StatusBadge tone="info">pipeline · {data.pipelineWatch.pipelineName}</StatusBadge>
            )}
            {typeof data?.pipelineWatch?.pipelinesCount === "number" && (
              <span className="text-xs text-muted-foreground">
                {data.pipelineWatch.pipelinesCount} pipeline(s) at location
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            classification: {data?.pipelineWatch?.classification ?? "—"}
            {data?.pipelineWatch?.status ? ` · http ${data.pipelineWatch.status}` : ""}
          </div>
          <p className="text-xs text-muted-foreground">
            Live mode replaces the demo Glow Med Spa / +1 555 records on the GHL Pipeline page with real contacts and opportunities from this location. Reads only; never writes.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Test HighLevel Private Integration token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              The candidate token is used in memory only. It is never stored, logged, or echoed back.
            </p>
            <Input
              data-testid="input-ghl-token"
              type="password"
              placeholder="Paste HighLevel Private Integration token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoComplete="off"
            />
            <Button
              size="sm"
              disabled={!tokenInput.trim() || testGhl.isPending}
              onClick={() => testGhl.mutate()}
              data-testid="button-test-ghl-token"
            >
              {testGhl.isPending ? "Testing…" : "Run read-only test"}
            </Button>
            {result && (
              <div className="rounded-md border border-card-border p-3 text-sm space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <StatusBadge tone={result.ok ? "ok" : "block"}>
                    {result.ok ? "ok" : result.classification}
                  </StatusBadge>
                  {result.highLevelStatus !== undefined && (
                    <span className="text-xs text-muted-foreground">HTTP {result.highLevelStatus}</span>
                  )}
                  {result.pipelinesFound !== undefined && (
                    <span className="text-xs text-muted-foreground">{result.pipelinesFound} pipelines</span>
                  )}
                </div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {result.nextSteps.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Test route API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Runs a hot-lead smoke test against{" "}
              <code className="font-mono">{data?.values.ROUTE_PROSPECT_API_URL}</code> server-side.
              Safe; no GHL writes.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => testRoute.mutate()}
              disabled={testRoute.isPending}
              data-testid="button-test-route-api"
            >
              {testRoute.isPending ? "Running…" : "Run smoke test"}
            </Button>
            {smokeResult && (
              <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-56 font-mono">
                {JSON.stringify(smokeResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">Environment variables</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded p-4 text-xs overflow-auto font-mono">{envBlock}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">Deployment instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Create a HighLevel Private Integration token with read scopes for opportunities and contacts.</li>
            <li>Paste all required env vars above into your hosting provider (Render, Vercel, etc.).</li>
            <li>Deploy. The server reads env vars at boot.</li>
            <li>Visit the dashboard. With no operator token: login is rejected.</li>
            <li>Enter the operator token to unlock. The token is held in React state only.</li>
            <li>Point <code className="font-mono">{data?.values.PROSPECTING_CUSTOM_DOMAIN ?? "prospecting-agent.lixenai.com"}</code> at the deployed app.</li>
            <li>Confirm scheduled QA brief: <code className="font-mono">{data?.scheduledQaBrief.cron} {data?.scheduledQaBrief.timezone}</code>.</li>
          </ol>
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            HighLevel calls in this app are read-only. Do not grant write/send scopes.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
