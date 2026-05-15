import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { AlertTriangle } from "lucide-react";

type Pipeline = {
  demo: boolean;
  diagnostic?: { status: number; classification: string };
  stages: {
    name: string; count: number;
    contacts: { id: string; name: string; phone?: string | null; lastActivity: string; score?: number; queuedHours?: number; stuck?: boolean; attempts?: number; capped?: boolean; enrichment?: string }[];
  }[];
  blockers: { id: string; text: string; severity: "warn" | "block" }[];
};

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.round(ms / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function GhlPipeline() {
  const { data } = useQuery<Pipeline>({ queryKey: ["/api/ghl/pipeline-watch"] });

  return (
    <>
      <PageHeader
        title="GHL Pipeline"
        subtitle="Read-only watch on medspa_prospect_ready and medspa_ai_call_queued tags. Never moves or writes opportunities."
        right={
          data?.demo ? (
            <StatusBadge tone="info">Demo data{data.diagnostic ? ` · ${data.diagnostic.classification}` : ""}</StatusBadge>
          ) : (
            <StatusBadge tone="ok">Live · read-only</StatusBadge>
          )
        }
      />

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
                          <div className="text-xs text-muted-foreground">
                            {c.phone ?? "no phone"}{c.score ? ` · score ${c.score}` : ""}
                          </div>
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
