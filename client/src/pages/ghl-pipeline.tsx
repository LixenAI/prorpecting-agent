import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge, Tone } from "@/components/status-badge";
import { AlertTriangle, Info } from "lucide-react";

type Diagnostic = {
  status: number;
  classification: string;
  step?: string;
  message?: string;
  pipelinesCount?: number;
  opportunitiesFetched?: number;
  nextSteps?: string[];
};

type PipelineContact = {
  id: string;
  name: string;
  business?: string | null;
  phone?: string | null;
  email?: string | null;
  tags?: string[];
  stage?: string;
  status?: string | null;
  lastActivity: string;
  score?: number;
  queuedHours?: number;
  stuck?: boolean;
  attempts?: number;
  capped?: boolean;
  enrichment?: string;
};

type Pipeline = {
  dataMode?: "live" | "fallback" | "error";
  demo?: boolean;
  fetchedAt?: string;
  pipelineName?: string;
  diagnostic?: Diagnostic;
  stages: { name: string; count: number; contacts: PipelineContact[] }[];
  blockers: { id: string; text: string; severity: "warn" | "block" }[];
};

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.round(ms / 3600000);
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function modeBadge(mode: Pipeline["dataMode"]): { tone: Tone; label: string } {
  if (mode === "live") return { tone: "ok", label: "Live GHL Data" };
  if (mode === "error") return { tone: "block", label: "GHL Error" };
  return { tone: "warn", label: "Demo Fallback" };
}

export default function GhlPipeline() {
  const { data } = useQuery<Pipeline>({ queryKey: ["/api/ghl/pipeline-watch"] });
  const mode = data?.dataMode ?? (data?.demo ? "fallback" : "live");
  const badge = modeBadge(mode);
  const diag = data?.diagnostic;

  return (
    <>
      <PageHeader
        title="GHL Pipeline"
        subtitle="Read-only watch on the prospecting pipeline. Never moves, writes, or messages contacts."
        right={
          <div className="flex items-center gap-2">
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            {data?.pipelineName && mode === "live" && (
              <StatusBadge tone="info">{data.pipelineName}</StatusBadge>
            )}
            {data?.fetchedAt && (
              <span className="text-xs text-muted-foreground">as of {ago(data.fetchedAt)} ago</span>
            )}
          </div>
        }
      />

      {(mode === "fallback" || mode === "error") && diag && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              {mode === "error" ? "Live GHL data unavailable" : "Showing demo data"}
            </div>
            <div className="text-xs space-y-1">
              <div>
                <span className="font-mono uppercase">classification:</span>{" "}
                <span className="font-mono">{diag.classification}</span>
                {diag.status ? (
                  <>
                    {" · "}
                    <span className="font-mono uppercase">http:</span>{" "}
                    <span className="font-mono">{diag.status}</span>
                  </>
                ) : null}
                {diag.step ? (
                  <>
                    {" · "}
                    <span className="font-mono uppercase">step:</span>{" "}
                    <span className="font-mono">{diag.step}</span>
                  </>
                ) : null}
              </div>
              {diag.message && <div className="opacity-80">{diag.message}</div>}
              {diag.nextSteps && diag.nextSteps.length > 0 && (
                <ul className="list-disc pl-5 mt-2">
                  {diag.nextSteps.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
              {mode === "fallback" && (
                <p className="mt-2 italic">
                  Contacts shown below are placeholders. Real GHL contacts will appear once the token is configured.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "live" && diag && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-900 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Live read-only fetch · {diag.pipelinesCount ?? 0} pipeline(s) ·{" "}
            {diag.opportunitiesFetched ?? 0} opportunities scanned
          </CardContent>
        </Card>
      )}

      {data?.blockers && data.blockers.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-amber-900 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" /> Pipeline blockers
            </div>
            <ul className="space-y-1 text-sm text-amber-900">
              {data.blockers.map((b) => (
                <li key={b.id} className="flex items-center gap-2">
                  <StatusBadge tone={b.severity}>{b.severity}</StatusBadge>
                  {b.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(data?.stages ?? []).map((s) => (
          <Card key={s.name}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between text-[hsl(217_80%_24%)]">
                {s.name}
                <StatusBadge tone="info">{s.count}</StatusBadge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.contacts.length === 0 ? (
                <div className="text-xs text-muted-foreground">No contacts displayed at this stage.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">Contact</th>
                      <th className="text-left py-1">Last activity</th>
                      <th className="text-left py-1">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.contacts.map((c) => (
                      <tr key={c.id} className="border-t border-card-border">
                        <td className="py-2">
                          <div className="font-medium">{c.name}</div>
                          {c.business && c.business !== c.name && (
                            <div className="text-xs text-muted-foreground">{c.business}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {c.phone ?? "no phone"}
                            {c.email ? ` · ${c.email}` : ""}
                            {c.score ? ` · score ${c.score}` : ""}
                          </div>
                          {c.tags && c.tags.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-1">
                              {c.tags.slice(0, 4).map((t) => (
                                <span key={t} className="bg-muted px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{ago(c.lastActivity)} ago</td>
                        <td className="py-2 text-xs">
                          {c.stuck && <StatusBadge tone="warn">stuck</StatusBadge>}
                          {c.capped && <StatusBadge tone="block">capped</StatusBadge>}
                          {c.enrichment === "missing-phone" && <StatusBadge tone="warn">no phone</StatusBadge>}
                          {!c.stuck && !c.capped && !c.enrichment && <StatusBadge tone="ok">ok</StatusBadge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
