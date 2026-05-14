import type { AppSettings, LeadStatus } from "../src/lib/types";

const boolEnv = (name: string, fallback: boolean) => {
  const value = process.env[name];
  if (value == null) return fallback;
  return value === "true" || value === "1";
};

const numEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

export function getSettingsFromEnv(): AppSettings {
  const stageMap: Record<LeadStatus, string | undefined> = {
    new_prospect: process.env.GHL_STAGE_NEW_PROSPECT,
    scored: process.env.GHL_STAGE_NEW_PROSPECT,
    ai_call_queued: process.env.GHL_STAGE_AI_CALL_QUEUED,
    called_no_answer: process.env.GHL_STAGE_CALLED_NO_ANSWER,
    interested: process.env.GHL_STAGE_INTERESTED,
    audit_booked: process.env.GHL_STAGE_AUDIT_BOOKED,
    no_show: process.env.GHL_STAGE_NO_SHOW,
    proposal_sent: process.env.GHL_STAGE_PROPOSAL_SENT,
    closed_won: process.env.GHL_STAGE_CLOSED_WON,
    closed_lost: process.env.GHL_STAGE_CLOSED_LOST,
    do_not_contact: process.env.GHL_STAGE_DO_NOT_CONTACT
  };

  return {
    aiCallProvider: (process.env.AI_CALL_PROVIDER as AppSettings["aiCallProvider"]) || "manual_webhook",
    dailyCallLimit: numEnv("AI_CALL_MAX_DAILY_CALLS", numEnv("MAX_DAILY_CALLS", 50)),
    hourlyRateLimit: numEnv("AI_CALL_RATE_LIMIT_PER_HOUR", 10),
    qualificationScoreThreshold: numEnv("QUALIFICATION_SCORE_THRESHOLD", 60),
    callingTimezone: process.env.CALLING_TIMEZONE || "America/Los_Angeles",
    callingStartHour: numEnv("CALLING_START_HOUR", 9),
    callingEndHour: numEnv("CALLING_END_HOUR", 17),
    maxCallAttempts: numEnv("MAX_CALL_ATTEMPTS", 3),
    bookingCalendarUrl: process.env.BOOKING_CALENDAR_URL,
    makeZapierWebhookUrl: process.env.MAKE_ZAPIER_WEBHOOK_URL || process.env.AI_CALL_WEBHOOK_URL,
    ghlPipelineId: process.env.GHL_PIPELINE_ID,
    ghlStageMap: stageMap,
    mockAiCaller: boolEnv("MOCK_AI_CALLER", true),
    mockGhl: boolEnv("MOCK_GHL", true)
  };
}

export const requiredPublicTags = [
  "medspa_prospect",
  "medspa_priority_a",
  "medspa_ai_call_queued",
  "medspa_called_no_answer",
  "medspa_interested",
  "medspa_audit_booked",
  "medspa_follow_up_needed",
  "do_not_contact"
];
