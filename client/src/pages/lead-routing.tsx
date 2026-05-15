import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Flame, FileWarning, Ban, Activity } from "lucide-react";

type Health = {
  ok: boolean;
  url: string;
  status: number;
  classification: string;
  routes: { id: string; label: string; when: string }[];
  stuck: { id: string; name: string; reason: string; currentRoute: string }[];
};

type SmokeResult = {
  ok: boolean;
  scenario: string;
  elapsedMs: number;
  request: unknown;
  response?: { status: number; body: unknown };
  error?: string;
};

export default function LeadRouting() {
  const { data } = useQuery<Health>({ queryKey: ["/api/routing/health"] });
  const [result, setResult] = useState<SmokeResult | null>(null);

  const smoke = useMutation({
    mutationFn: async (scenario: "hot" | "missing" | "dnc") => {
      const r = await apiRequest("POST", "/api/routing/smoke-test", { scenario });
      return (await r.json()) as SmokeResult;
    },
    onSuccess: (r) => setResult(r),
    onError: (err: any) => setResult({ ok: false, scenario: "error", elapsedMs: 0, request: {}, error: String(err?.message || err) }),
  });

  return (
    <>
      <PageHeader
        title="Lead Routing"
        subtitle="Health check + safe smoke tests for the public /api/route-prospect endpoint. Tests run server-side and never modify GHL."
      />

      <Card className="mb-6">
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Route API</div>
            <div className="text-sm font-mono mt-1 break-all">{data?.url}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last probe</div>
            <div className="mt-1">
              <StatusBadge tone={data?.ok ? "ok" : "warn"}>
                {data?.classification ?? "…"} {data?.status ? `· ${data.status}` : ""}
              </StatusBadge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SmokeCard
          icon={<Flame className="w-4 h-4" />}
          title="Hot lead"
          desc="Score 85, full data, not DNC. Should route to Outreach Caller."
          tone="ok"
          loading={smoke.isPending && smoke.variables === "hot"}
          onRun={() => smoke.mutate("hot")}
        />
        <SmokeCard
          icon={<FileWarning className="w-4 h-4" />}
          title="Missing data"
          desc="No phone, no business name. Should route to General / Status Alignment or Hold."
          tone="warn"
          loading={smoke.isPending && smoke.variables === "missing"}
          onRun={() => smoke.mutate("missing")}
        />
        <SmokeCard
          icon={<Ban className="w-4 h-4" />}
          title="Do not contact"
          desc="DNC flag true. Should route to Hold and never enqueue Ava."
          tone="block"
          loading={smoke.isPending && smoke.variables === "dnc"}
          onRun={() => smoke.mutate("dnc")}
        />
      </div>

      {result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">
              Smoke test result — {result.scenario}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <StatusBadge tone={result.ok ? "ok" : "block"}>
                {result.ok ? "ok" : "failed"}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">{result.elapsedMs} ms</span>
              {result.response && (
                <span className="text-xs text-muted-foreground">HTTP {result.response.status}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-medium mb-1">Request</div>
                <pre className="bg-muted rounded p-3 overflow-auto max-h-72 font-mono">
                  {JSON.stringify(result.request, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-medium mb-1">Response</div>
                <pre className="bg-muted rounded p-3 overflow-auto max-h-72 font-mono">
                  {JSON.stringify(result.response?.body ?? result.error, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <Activity className="w-4 h-4" /> Routes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.routes ?? []).map((r) => (
              <div key={r.id} className="text-sm">
                <div className="font-medium text-[hsl(217_80%_24%)]">{r.label}</div>
                <div className="text-muted-foreground text-xs">{r.when}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Stuck routing</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Contact</th>
                  <th className="text-left py-1">Reason</th>
                  <th className="text-left py-1">Current route</th>
                </tr>
              </thead>
              <tbody>
                {(data?.stuck ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-card-border">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-xs"><StatusBadge tone="warn">{s.reason}</StatusBadge></td>
                    <td className="py-2 text-muted-foreground">{s.currentRoute}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SmokeCard({
  icon, title, desc, tone, loading, onRun,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "ok" | "warn" | "block";
  loading: boolean;
  onRun: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-1 text-[hsl(217_80%_24%)] font-medium">
          {icon} {title} <StatusBadge tone={tone}>safe</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{desc}</p>
        <Button size="sm" onClick={onRun} disabled={loading} data-testid={`button-smoke-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {loading ? "Running…" : "Run smoke test"}
        </Button>
      </CardContent>
    </Card>
  );
}
