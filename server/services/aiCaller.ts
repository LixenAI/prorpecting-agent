import { nanoid } from "nanoid";
import { getCallEligibility } from "../../src/lib/compliance";
import { defaultCallScript } from "../../src/lib/callScript";
import type { AppSettings, Lead, QueueResult } from "../../src/lib/types";
import { getLeads, saveLeads, updateLead } from "../data/store";
import { syncLeadToGhl } from "./ghl";
import { notifyTeam } from "./notifications";

function sameDay(dateIso: string | undefined, now: Date) {
  if (!dateIso) return false;
  const date = new Date(dateIso);
  return date.toDateString() === now.toDateString();
}

function sameHour(dateIso: string | undefined, now: Date) {
  if (!dateIso) return false;
  const date = new Date(dateIso);
  return date.toDateString() === now.toDateString() && date.getHours() === now.getHours();
}

export async function getCallVolume(settings: AppSettings, now = new Date()) {
  const leads = await getLeads();
  const lastContacts = leads.map((lead) => lead.lastContactedAt).filter(Boolean) as string[];
  return {
    today: lastContacts.filter((value) => sameDay(value, now)).length,
    thisHour: lastContacts.filter((value) => sameHour(value, now)).length,
    dailyLimit: settings.dailyCallLimit,
    hourlyLimit: settings.hourlyRateLimit
  };
}

async function sendToProvider(lead: Lead, settings: AppSettings) {
  const payload = {
    provider: settings.aiCallProvider,
    agentId: process.env.AI_CALL_AGENT_ID,
    fromNumber: process.env.AI_CALL_FROM_NUMBER,
    leadId: lead.id,
    businessName: lead.businessName,
    phone: lead.phone,
    website: lead.website,
    score: lead.score,
    tier: lead.scoreBreakdown?.tier,
    script: defaultCallScript,
    webhookUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:8787"}/api/ai-call/outcome`
  };

  if (settings.mockAiCaller) {
    console.info("[ai-caller:mock]", JSON.stringify(payload));
    return { ok: true, aiCallId: `mock-call-${nanoid(8)}` };
  }

  const webhookUrl = process.env.AI_CALL_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, error: "AI_CALL_WEBHOOK_URL is required when MOCK_AI_CALLER=false." };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AI_CALL_API_KEY ? { Authorization: `Bearer ${process.env.AI_CALL_API_KEY}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; callId?: string; aiCallId?: string; message?: string };
    if (!response.ok) throw new Error(data.message || `AI call provider failed with ${response.status}`);
    return { ok: true, aiCallId: data.aiCallId || data.callId || data.id || `provider-call-${nanoid(8)}` };
  } catch (error) {
    console.error("[ai-caller:error]", error);
    return { ok: false, error: String(error) };
  }
}

export async function queueAiCall(lead: Lead, settings: AppSettings, now = new Date()): Promise<QueueResult> {
  const eligibility = getCallEligibility(lead, settings, now);
  if (!eligibility.eligible) {
    return { ok: false, lead, message: "Lead is not eligible for AI calling.", blockedReasons: eligibility.reasons };
  }

  const volume = await getCallVolume(settings, now);
  if (volume.today >= settings.dailyCallLimit) {
    return { ok: false, lead, message: "Daily call limit reached.", blockedReasons: ["Daily call limit reached."] };
  }
  if (volume.thisHour >= settings.hourlyRateLimit) {
    return { ok: false, lead, message: "Hourly call rate limit reached.", blockedReasons: ["Hourly call rate limit reached."] };
  }

  const ghl = await syncLeadToGhl(lead, settings, "ai_call_queued");
  const leadForCall = {
    ...lead,
    ghlContactId: ghl.contactId || lead.ghlContactId,
    ghlOpportunityId: ghl.opportunityId || lead.ghlOpportunityId
  };
  const provider = await sendToProvider(leadForCall, settings);
  const nowIso = now.toISOString();

  if (!provider.ok) {
    await notifyTeam({
      event: "ai_call_failed",
      lead,
      callSummary: provider.error,
      nextAction: "Check AI caller provider configuration or switch to mock/manual_webhook."
    });
    return { ok: false, lead, message: "AI caller provider failed.", blockedReasons: [provider.error ?? "Provider failed."] };
  }

  const updated = await updateLead(lead.id, (current) => ({
    ...current,
    ghlContactId: ghl.contactId || current.ghlContactId,
    ghlOpportunityId: ghl.opportunityId || current.ghlOpportunityId,
    aiCallId: provider.aiCallId,
    status: "ai_call_queued",
    callStatus: "queued",
    callAttempts: current.callAttempts + 1,
    lastContactedAt: nowIso,
    callLogs: [
      {
        id: nanoid(),
        aiCallId: provider.aiCallId,
        status: "queued",
        summary: settings.mockAiCaller ? "Mock AI call queued. Simulate outcome from the lead detail page." : "AI call queued.",
        createdAt: nowIso
      },
      ...current.callLogs
    ]
  }));

  const leads = await getLeads();
  await saveLeads(leads);

  return {
    ok: true,
    lead: updated,
    aiCallId: provider.aiCallId,
    message: settings.mockAiCaller ? "Mock AI call queued." : "AI call queued."
  };
}
