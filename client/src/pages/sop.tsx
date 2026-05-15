import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/status-badge";

export default function Sop() {
  return (
    <>
      <PageHeader
        title="SOP — LixenAI Prospecting Agent"
        subtitle="Daily operating checklist for Rob and Renn. Keep it concise. The dashboard observes; humans approve sends."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Daily checks (before 11:30 AM PT)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Dashboard. Confirm readiness ≥ 80.</li>
              <li>Confirm Ava Outbound is configured (or flag the blocker).</li>
              <li>Run a Hot smoke test on Lead Routing.</li>
              <li>Scan GHL Pipeline for stuck leads &gt; 1 day in AI Call Queued.</li>
              <li>Review no-answer streaks; stop any contact at 3 attempts.</li>
              <li>Review manual-review list; approve or reject.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Required prospect fields</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>First name (or business owner name)</li>
              <li>Phone number (E.164 preferred)</li>
              <li>Business name</li>
              <li>Website</li>
              <li>City + state</li>
              <li>Source / lead origin</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Missing required fields → route to <span className="font-medium">General / Status Alignment</span> for enrichment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Scoring bands</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge tone="ok">80–100</StatusBadge>
              <span>Hot — eligible for Outreach Caller (Ava) immediately.</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="info">60–79</StatusBadge>
              <span>Warm — eligible after enrichment / one human spot-check.</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="warn">40–59</StatusBadge>
              <span>General / Status Alignment — needs more data.</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="block">&lt; 40</StatusBadge>
              <span>Hold — do not queue.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Routing logic</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">Outreach Caller:</span> score ≥ 60, phone present, not DNC, has business name.</li>
              <li><span className="font-medium">General / Status Alignment:</span> 40 ≤ score &lt; 60, or partial data.</li>
              <li><span className="font-medium">Hold:</span> missing critical data, DNC conflict, or capped at 3 no answers.</li>
              <li><span className="font-medium">Never:</span> route to outbound through GHL email/SMS; cold lane stays in voice / external email.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Compliance rules</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <ul className="list-disc pl-5 space-y-1">
              <li>No outbound dial until A2P/voice compliance is confirmed for the caller ID.</li>
              <li>Ava must disclose AI honestly when asked.</li>
              <li>Capture opt-outs immediately; mark <code className="font-mono text-xs">do_not_contact = true</code> in GHL.</li>
              <li>Respect 8am–8pm local quiet hours.</li>
              <li>Cap at 3 attempts per contact, with a minimum 24-hour gap.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[hsl(217_80%_24%)]">Manual review criteria</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <ul className="list-disc pl-5 space-y-1">
              <li>Stuck &gt; 1 day in AI Call Queued.</li>
              <li>Stuck &gt; 2 days in General / Follow-Up Needed.</li>
              <li>Score ≥ 60 but not queued for outreach.</li>
              <li>Missing phone, business name, website, or city.</li>
              <li>DNC conflict (queued but flagged DNC).</li>
              <li>Ava call ended with low confidence or transcript anomaly.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
