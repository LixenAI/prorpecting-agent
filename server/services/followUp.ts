import type { Lead } from "../../src/lib/types";

export async function triggerFollowUp(lead: Lead, event: string, extra: Record<string, unknown> = {}) {
  const webhookUrl = process.env.MAKE_ZAPIER_WEBHOOK_URL;
  const payload = {
    event,
    leadId: lead.id,
    businessName: lead.businessName,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    status: lead.status,
    score: lead.score,
    nextFollowUpAt: lead.nextFollowUpAt,
    ...extra
  };

  if (!webhookUrl) {
    console.info("[follow-up:mock]", JSON.stringify(payload));
    return { ok: true, mocked: true };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("[follow-up:error]", error);
    return { ok: false, error: String(error) };
  }
}
