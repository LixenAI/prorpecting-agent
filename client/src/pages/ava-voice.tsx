import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type IntegrationsStatus = {
  values: { LIXEN_VOICE_AGENT_NAME: string };
};

export default function AvaVoice() {
  const { data } = useQuery<IntegrationsStatus>({ queryKey: ["/api/integrations/status"] });

  const checklist: { id: string; label: string; ok: boolean; note?: string }[] = [
    { id: "outbound", label: "Outbound direction enabled", ok: false, note: "Pending confirmation in Ava settings" },
    { id: "callerid", label: "Caller ID assigned", ok: false, note: "Confirm registered number for outbound" },
    { id: "compliance", label: "Compliance / A2P registration complete", ok: false, note: "Required before any outbound dial" },
    { id: "hours", label: "Working hours set", ok: true },
    { id: "published", label: "Published / deployed", ok: true },
  ];

  const allOk = checklist.every((c) => c.ok);

  return (
    <>
      <PageHeader
        title="Ava Voice AI"
        subtitle={`Configuration check for ${data?.values.LIXEN_VOICE_AGENT_NAME ?? "Ava — Med Spa Prospecting Agent"}.`}
        right={
          allOk ? (
            <StatusBadge tone="ok">Outbound ready</StatusBadge>
          ) : (
            <StatusBadge tone="warn">Outbound not confirmed</StatusBadge>
          )
        }
      />

      {!allOk && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" /> Outbound not confirmed
            </div>
            Ava cannot place outbound prospecting calls until outbound direction, caller ID,
            and compliance/registration are complete. The prospecting agent will still tag
            and queue leads, but no dials will go out.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Configuration checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  )}
                  <div>
                    <div className="font-medium">{c.label}</div>
                    {c.note && <div className="text-xs text-muted-foreground">{c.note}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Current script summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Positioned as a 24/7 missed call and lead recovery assistant for med spas. Frames the
              value as "never lose a lead," supporting the team's follow-up.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Slower pacing, value-first opener.</li>
              <li>Asks for first name and email before pitching.</li>
              <li>Honest AI disclosure when asked.</li>
              <li>No guarantee language; offers a free audit booking link.</li>
              <li>Opt-out handling: marks DNC, never re-attempts.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(217_80%_24%)]">Test instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Use only verified Rob contacts for outbound testing. Do <span className="font-semibold">not</span>{" "}
            bulk-trigger Ava against the prospect list during testing.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Add Rob's verified phone as a sandbox contact in GHL.</li>
            <li>Apply the <code className="font-mono text-xs">medspa_ai_call_queued</code> tag manually.</li>
            <li>Watch the audit log for Ava call status updates.</li>
            <li>After the call, mark the contact reviewed in GHL.</li>
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
