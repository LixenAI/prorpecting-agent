import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { Clock, CalendarCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

type Status = {
  copy: string;
  schedule: {
    name: string; cron: string; timezone: string;
    nextRun: string; lastRun: string; lastStatus: string;
  };
  queues: {
    auto: string[];
    approvalRequired: string[];
    blocked: string[];
    completed: { ts: string; text: string }[];
  };
  recentChecks: { ts: string; summary: string }[];
};

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function Autopilot() {
  const { data } = useQuery<Status>({ queryKey: ["/api/autopilot/status"] });

  return (
    <>
      <PageHeader
        title="Autopilot Monitor"
        subtitle="Daily 11:30 AM weekday QA brief. The dashboard watches the prospecting agent and Ava outbound — it does not blindly send messages."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Schedule</div>
            <div className="text-sm font-semibold text-[hsl(217_80%_24%)] mt-1">
              {data?.schedule.name ?? "…"}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {data?.schedule.cron} · {data?.schedule.timezone}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <CalendarCheck className="w-3 h-3" /> Next check
            </div>
            <div className="text-sm font-semibold mt-1">{fmt(data?.schedule.nextRun)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last check
            </div>
            <div className="text-sm font-semibold mt-1 flex items-center gap-2">
              {fmt(data?.schedule.lastRun)}
              <StatusBadge tone={data?.schedule.lastStatus === "ok" ? "ok" : "warn"}>
                {data?.schedule.lastStatus ?? "—"}
              </StatusBadge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 bg-[hsl(211_60%_95%)] border-[hsl(211_70%_85%)]">
        <CardContent className="py-4 text-sm text-[hsl(217_80%_24%)]">
          {data?.copy}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Queue title="Auto checks" items={data?.queues.auto ?? []} tone="ok" />
        <Queue title="Approval required" items={data?.queues.approvalRequired ?? []} tone="warn" />
        <Queue
          title="Blocked"
          items={data?.queues.blocked ?? []}
          tone="block"
          empty="No blockers."
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
              <CheckCircle2 className="w-4 h-4" /> Recent completions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.queues.completed ?? []).map((c, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
                  {fmt(c.ts)}
                </span>
                <span>{c.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Queue({
  title, items, tone, empty = "Queue empty.",
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn" | "block";
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-[hsl(217_80%_24%)]">
          {tone === "block" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          {title}
          <StatusBadge tone={tone}>{items.length}</StatusBadge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{empty}</div>
        ) : (
          <ul className="space-y-2">
            {items.map((t, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(211_70%_39%)] mt-2 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
