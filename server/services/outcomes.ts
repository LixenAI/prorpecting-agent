import { addDays } from "date-fns";
import { nanoid } from "nanoid";
import type { AiCallOutcomePayload, AppSettings, Lead } from "../../src/lib/types";
import { updateLead } from "../data/store";
import { bookCalendarAppointment, syncLeadToGhl } from "./ghl";
import { notifyTeam } from "./notifications";
import { triggerFollowUp } from "./followUp";

export async function handleAiCallOutcome(payload: AiCallOutcomePayload, settings: AppSettings) {
  const updated = await updateLead(payload.leadId, (lead) => applyOutcomeToLead(lead, payload, settings));
  if (!updated) return { ok: false, message: "Lead not found." };

  if (updated.status === "interested") {
    await syncLeadToGhl(updated, settings, "interested");
    await triggerFollowUp(updated, "interested", { summary: payload.summary });
    await notifyTeam({
      event: "lead_interested",
      lead: updated,
      callSummary: payload.summary,
      nextAction: "Send booking link and prepare lead-loss audit."
    });
  }

  if (updated.status === "audit_booked") {
    await syncLeadToGhl(updated, settings, "audit_booked");
    if (payload.appointmentTime) await bookCalendarAppointment(updated, payload.appointmentTime, settings);
    await triggerFollowUp(updated, "audit_booked", { appointmentTime: payload.appointmentTime });
    await notifyTeam({
      event: "audit_booked",
      lead: updated,
      callSummary: payload.summary,
      nextAction: "Send confirmation and reminder workflow."
    });
  }

  if (updated.status === "called_no_answer") {
    await syncLeadToGhl(updated, settings, "called_no_answer");
    await triggerFollowUp(updated, "called_no_answer", { retryAt: updated.nextFollowUpAt });
  }

  if (updated.status === "do_not_contact") {
    await syncLeadToGhl(updated, settings, "do_not_contact");
    await notifyTeam({
      event: "opt_out_requested",
      lead: updated,
      callSummary: payload.summary,
      nextAction: "Confirm all workflows suppress this lead."
    });
  }

  return { ok: true, lead: updated };
}

export function applyOutcomeToLead(lead: Lead, payload: AiCallOutcomePayload, settings: Pick<AppSettings, "maxCallAttempts">): Lead {
  const now = new Date();
  const callStatus = payload.optOutRequested
    ? "opted_out"
    : payload.appointmentBooked
      ? "audit_booked"
      : payload.interested
        ? "interested"
        : payload.callStatus === "no_answer"
          ? "no_answer"
          : ((payload.callStatus as Lead["callStatus"]) || "completed");

  const status = payload.optOutRequested
    ? "do_not_contact"
    : payload.appointmentBooked
      ? "audit_booked"
      : payload.interested
        ? "interested"
        : payload.callStatus === "no_answer"
          ? "called_no_answer"
          : lead.status;

  const shouldRetry = status === "called_no_answer" && lead.callAttempts < settings.maxCallAttempts;
  return {
    ...lead,
    status,
    callStatus,
    optOut: payload.optOutRequested ? true : lead.optOut,
    aiCallId: payload.aiCallId || lead.aiCallId,
    email: payload.emailCaptured || lead.email,
    phone: payload.phoneConfirmed || lead.phone,
    appointmentTime: payload.appointmentTime || lead.appointmentTime,
    nextFollowUpAt: shouldRetry ? addDays(now, 2).toISOString() : lead.nextFollowUpAt,
    callLogs: [
      {
        id: nanoid(),
        aiCallId: payload.aiCallId || lead.aiCallId,
        status: callStatus,
        transcript: payload.transcript,
        summary: payload.summary || payload.objections?.join("; "),
        createdAt: now.toISOString()
      },
      ...lead.callLogs
    ]
  };
}
