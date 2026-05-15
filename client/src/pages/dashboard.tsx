import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge, Tone } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Info, ListChecks, Sparkles } from "lucide-react";

type Summary = {
  readiness: number;
  cards: { id: string; label: string; value: string; tone: Tone }[];
  todoBeforeOutbound: string[];
  keyRisk: { id: string; severity: "info" | "warn" | "block"; text: string };
  recommendations: { id: string; severity: "info" | "warn" | "block"; text: string }[];
};

const sevToTone: Record<string, Tone> = { info: "info", warn: "warn", block: "block" };

export default function Dashboard() {
  const { data, isLoading } = useQuery<Summary>({ queryKey: ["/api/dashboard/summary"] });

  return (
    <>
      <PageHeader
        title="Morning outbound readiness"
        subtitle="Quick check of whether the LixenAI Prospecting Agent and Ava outbound workflow are running before the team starts the day."
        right={
          <StatusBadge tone={data && data.readiness >= 80 ? "ok" : data && data.readiness >= 60 ? "warn" : "block"}>
            Readiness {data?.readiness ?? "…"}/100
          </StatusBadge>
        }
      />

      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-[hsl(217_80%_24%)]">System readiness</div>
            <div className="text-sm text-muted-foreground font-mono">{data?.readiness ?? 0}%</div>
          </div>
          <Progress value={data?.readiness ?? 0} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(data?.cards ?? []).map((c) => (
          <Card key={c.id} className="hover-elevate">
            <CardContent className="py-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {c.label}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-[hsl(217_80%_24%)]">{c.value}</div>
                <StatusBadge tone={c.tone}>{c.tone === "ok" ? "ok" : c.tone}</StatusBadge>
              </div>
            </CardContent>
          </Card>
        ))}
        {isLoading && Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}><CardContent className="py-4 h-[76px] animate-pulse bg-muted/40 rounded" /></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <ListChecks className="w-4 h-4" /> Before outbound — Rob &amp; Renn checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data?.todoBeforeOutbound ?? []).map((t, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(211_70%_39%)] mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <Sparkles className="w-4 h-4" /> Today's key risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.keyRisk ? (
              <div className="flex items-start gap-3">
                {data.keyRisk.severity === "block" ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                ) : data.keyRisk.severity === "warn" ? (
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                ) : (
                  <Info className="w-5 h-5 text-[hsl(211_70%_39%)] mt-0.5 shrink-0" />
                )}
                <div>
                  <StatusBadge tone={sevToTone[data.keyRisk.severity]} className="mb-2">
                    {data.keyRisk.severity.toUpperCase()}
                  </StatusBadge>
                  <p className="text-sm">{data.keyRisk.text}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No risk surfaced.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">All recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recommendations ?? []).map((r) => (
            <div key={r.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0 border-card-border">
              <StatusBadge tone={sevToTone[r.severity]}>{r.severity}</StatusBadge>
              <span className="text-foreground">{r.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
