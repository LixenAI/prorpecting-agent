import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";

type Event = { id: string; ts: string; kind: string; summary: string; detail?: Record<string, unknown> };

const kindTone: Record<string, "ok" | "warn" | "info" | "block" | "neutral"> = {
  system: "neutral",
  check: "ok",
  "smoke-test": "info",
  ghl: "info",
  integrations: "warn",
};

export default function AuditLog() {
  const { data } = useQuery<{ events: Event[] }>({ queryKey: ["/api/audit-log"] });

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Read-only record of dashboard checks, smoke tests, GHL read attempts, blockers, and recommendations. No secrets are stored or shown."
      />

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-2 w-44">Timestamp</th>
                <th className="text-left py-2 px-2 w-32">Kind</th>
                <th className="text-left py-2 px-2">Summary</th>
                <th className="text-left py-2 px-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((e) => (
                <tr key={e.id} className="border-t border-card-border align-top">
                  <td className="py-2 px-2 font-mono text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td className="py-2 px-2">
                    <StatusBadge tone={kindTone[e.kind] ?? "neutral"}>{e.kind}</StatusBadge>
                  </td>
                  <td className="py-2 px-2">{e.summary}</td>
                  <td className="py-2 px-2">
                    {e.detail ? (
                      <pre className="text-[11px] font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1 inline-block max-w-md overflow-auto">
                        {JSON.stringify(e.detail)}
                      </pre>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
