import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { CheckCircle2, XCircle, PhoneOff } from "lucide-react";

type Calls = {
  date: string;
  attempted: number;
  connected: number;
  noAnswer: number;
  interested: number;
  auditBooked: number;
  notInterested: number;
  doNotContact: number;
  avaQualityChecks: { id: string; label: string; ok: boolean }[];
  noAnswerStreaks: { id: string; name: string; attempts: number; capped?: boolean }[];
};

export default function CallOutreach() {
  const { data } = useQuery<Calls>({ queryKey: ["/api/calls/summary"] });

  const total = Math.max(data?.attempted ?? 1, 1);
  const dist = [
    { id: "connected", label: "Connected", value: data?.connected ?? 0, color: "bg-emerald-500" },
    { id: "no-answer", label: "No answer", value: data?.noAnswer ?? 0, color: "bg-amber-500" },
    { id: "interested", label: "Interested", value: data?.interested ?? 0, color: "bg-[hsl(212_100%_69%)]" },
    { id: "audit", label: "Audit booked", value: data?.auditBooked ?? 0, color: "bg-[hsl(211_70%_39%)]" },
    { id: "not", label: "Not interested", value: data?.notInterested ?? 0, color: "bg-muted" },
    { id: "dnc", label: "Do not contact", value: data?.doNotContact ?? 0, color: "bg-rose-500" },
  ];

  return (
    <>
      <PageHeader
        title="Call Outreach"
        subtitle={`Daily call outreach metrics for ${data?.date ?? "today"}. The dashboard reports; Ava does the calling.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
        <Stat label="Attempted" value={data?.attempted} />
        <Stat label="Connected" value={data?.connected} tone="ok" />
        <Stat label="No answer" value={data?.noAnswer} tone="warn" />
        <Stat label="Interested" value={data?.interested} tone="info" />
        <Stat label="Audit booked" value={data?.auditBooked} tone="ok" />
        <Stat label="Not interested" value={data?.notInterested} />
        <Stat label="DNC" value={data?.doNotContact} tone="block" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">Call outcome distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dist.map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{d.label}</span>
                <span className="font-mono text-muted-foreground">
                  {d.value} · {Math.round((d.value / total) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className={`${d.color} h-full`}
                  style={{ width: `${(d.value / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <PhoneOff className="w-4 h-4" /> No-answer streaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Flag at 2+ no answers. Stop after 3 attempts.
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Contact</th>
                  <th className="text-left py-1">Attempts</th>
                  <th className="text-left py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.noAnswerStreaks ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-card-border">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 font-mono">{s.attempts}</td>
                    <td className="py-2">
                      <StatusBadge tone={s.capped ? "block" : s.attempts >= 2 ? "warn" : "info"}>
                        {s.capped ? "capped" : s.attempts >= 2 ? "review" : "ok"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Ava call quality checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data?.avaQualityChecks ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  {c.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "ok" | "warn" | "info" | "block" }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-[hsl(217_80%_24%)] mt-1">{value ?? "—"}</div>
        {tone && <div className="mt-1"><StatusBadge tone={tone}>{tone}</StatusBadge></div>}
      </CardContent>
    </Card>
  );
}
