import type { AppSettings, Lead } from "./types";

export function isWithinCallingHours(date: Date, settings: Pick<AppSettings, "callingTimezone" | "callingStartHour" | "callingEndHour">) {
  const hourText = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.callingTimezone,
    hour: "numeric",
    hour12: false
  }).format(date);
  const hour = Number(hourText);
  return hour >= settings.callingStartHour && hour < settings.callingEndHour;
}

export function validateB2BLead(lead: Lead) {
  const reasons: string[] = [];
  if (!lead.businessName?.trim()) reasons.push("Business name is required.");
  if (!lead.phone?.trim()) reasons.push("Business phone is required.");
  if (!lead.source?.trim()) reasons.push("Lead source is required.");
  if (lead.optOut) reasons.push("Lead has opted out.");
  if (lead.status === "do_not_contact") reasons.push("Lead is marked Do Not Contact.");
  return reasons;
}

export function getCallEligibility(lead: Lead, settings: AppSettings, now = new Date()) {
  const reasons = validateB2BLead(lead);
  const threshold = settings.qualificationScoreThreshold;
  const score = lead.score ?? lead.scoreBreakdown?.totalScore ?? 0;

  if (score < threshold) reasons.push(`Lead score ${score} is below qualification threshold ${threshold}.`);
  if (lead.callAttempts >= settings.maxCallAttempts) reasons.push(`Lead already reached max attempts (${settings.maxCallAttempts}).`);
  if (!isWithinCallingHours(now, settings)) {
    reasons.push(
      `Outside allowed calling hours (${settings.callingStartHour}:00-${settings.callingEndHour}:00 ${settings.callingTimezone}).`
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}
