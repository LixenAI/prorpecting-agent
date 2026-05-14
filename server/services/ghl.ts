import type { AppSettings, Lead, LeadStatus } from "../../src/lib/types";
import { requiredPublicTags } from "../config";
import { notifyTeam } from "./notifications";

const baseUrl = "https://services.leadconnectorhq.com";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
    Version: "2021-07-28",
    "Content-Type": "application/json"
  };
}

function tagsForLead(lead: Lead) {
  const tags = new Set<string>(["medspa_prospect"]);
  if (lead.scoreBreakdown?.tier === "Priority A") tags.add("medspa_priority_a");
  if (lead.status === "ai_call_queued") tags.add("medspa_ai_call_queued");
  if (lead.status === "called_no_answer") tags.add("medspa_called_no_answer");
  if (lead.status === "interested") tags.add("medspa_interested");
  if (lead.status === "audit_booked") tags.add("medspa_audit_booked");
  if (lead.status === "do_not_contact" || lead.optOut) tags.add("do_not_contact");
  return Array.from(tags).filter((tag) => requiredPublicTags.includes(tag) || tag === "medspa_prospect");
}

export async function createOrUpdateGhlContact(lead: Lead, settings: AppSettings) {
  const payload = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName: lead.ownerName || lead.managerName || lead.businessName,
    companyName: lead.businessName,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    city: lead.city,
    state: lead.state,
    tags: tagsForLead(lead),
    source: lead.source,
    customFields: [
      { key: "medspa_score", field_value: lead.score },
      { key: "medspa_tier", field_value: lead.scoreBreakdown?.tier },
      { key: "visible_weaknesses", field_value: lead.visibleWeaknesses.join("; ") }
    ]
  };

  if (settings.mockGhl || !process.env.GHL_ACCESS_TOKEN || !process.env.GHL_LOCATION_ID) {
    console.info("[ghl:mock:contact]", JSON.stringify(payload));
    return { ok: true, contactId: lead.ghlContactId || `mock-ghl-contact-${lead.id}` };
  }

  try {
    const response = await fetch(`${baseUrl}/contacts/upsert`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => ({}))) as { contact?: { id?: string }; id?: string; message?: string };
    if (!response.ok) throw new Error(data.message || `GHL contact sync failed with ${response.status}`);
    return { ok: true, contactId: data.contact?.id || data.id };
  } catch (error) {
    console.error("[ghl:error:contact]", error);
    await notifyTeam({
      event: "ghl_sync_failed",
      lead,
      callSummary: String(error),
      nextAction: "Check GHL credentials, location ID, and contact payload mapping."
    });
    return { ok: false, error: String(error) };
  }
}

export async function createOrUpdateOpportunity(lead: Lead, status: LeadStatus, settings: AppSettings) {
  const stageId = settings.ghlStageMap[status];
  const payload = {
    locationId: process.env.GHL_LOCATION_ID,
    pipelineId: process.env.GHL_PIPELINE_ID || settings.ghlPipelineId,
    pipelineStageId: stageId,
    contactId: lead.ghlContactId,
    name: `${lead.businessName} - Lead Loss Audit`,
    status: "open",
    monetaryValue: 0
  };

  if (settings.mockGhl || !process.env.GHL_ACCESS_TOKEN || !payload.pipelineId || !payload.pipelineStageId) {
    console.info("[ghl:mock:opportunity]", JSON.stringify(payload));
    return { ok: true, opportunityId: lead.ghlOpportunityId || `mock-ghl-opportunity-${lead.id}` };
  }

  try {
    const response = await fetch(`${baseUrl}/opportunities/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => ({}))) as { opportunity?: { id?: string }; id?: string; message?: string };
    if (!response.ok) throw new Error(data.message || `GHL opportunity sync failed with ${response.status}`);
    return { ok: true, opportunityId: data.opportunity?.id || data.id };
  } catch (error) {
    console.error("[ghl:error:opportunity]", error);
    await notifyTeam({
      event: "ghl_sync_failed",
      lead,
      callSummary: String(error),
      nextAction: "Review GHL pipeline and stage IDs."
    });
    return { ok: false, error: String(error) };
  }
}

export async function syncLeadToGhl(lead: Lead, settings: AppSettings, status: LeadStatus = lead.status) {
  const contact = await createOrUpdateGhlContact(lead, settings);
  const leadWithContact = contact.contactId ? { ...lead, ghlContactId: contact.contactId } : lead;
  const opportunity = await createOrUpdateOpportunity(leadWithContact, status, settings);
  return {
    ok: contact.ok && opportunity.ok,
    contactId: contact.contactId,
    opportunityId: opportunity.opportunityId,
    errors: [contact.error, opportunity.error].filter(Boolean)
  };
}

export async function bookCalendarAppointment(lead: Lead, appointmentTime: string, settings: AppSettings) {
  const payload = {
    calendarId: process.env.GHL_CALENDAR_ID,
    locationId: process.env.GHL_LOCATION_ID,
    contactId: lead.ghlContactId,
    startTime: appointmentTime,
    title: `Lead Loss Audit - ${lead.businessName}`
  };

  if (settings.mockGhl || !process.env.GHL_ACCESS_TOKEN || !process.env.GHL_CALENDAR_ID) {
    console.info("[ghl:mock:appointment]", JSON.stringify(payload));
    return { ok: true, appointmentId: `mock-appointment-${lead.id}` };
  }

  try {
    const response = await fetch(`${baseUrl}/calendars/events/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) throw new Error(data.message || `GHL appointment booking failed with ${response.status}`);
    return { ok: true, appointmentId: data.id };
  } catch (error) {
    console.error("[ghl:error:appointment]", error);
    return { ok: false, error: String(error) };
  }
}
