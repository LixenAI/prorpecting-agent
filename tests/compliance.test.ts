import { describe, expect, it } from "vitest";
import { getCallEligibility, isWithinCallingHours } from "../src/lib/compliance";
import type { AppSettings, Lead } from "../src/lib/types";

const settings: AppSettings = {
  aiCallProvider: "manual_webhook",
  dailyCallLimit: 50,
  hourlyRateLimit: 10,
  qualificationScoreThreshold: 60,
  callingTimezone: "America/Los_Angeles",
  callingStartHour: 9,
  callingEndHour: 17,
  maxCallAttempts: 3,
  ghlStageMap: {
    new_prospect: undefined,
    scored: undefined,
    ai_call_queued: undefined,
    called_no_answer: undefined,
    interested: undefined,
    audit_booked: undefined,
    no_show: undefined,
    proposal_sent: undefined,
    closed_won: undefined,
    closed_lost: undefined,
    do_not_contact: undefined
  },
  mockAiCaller: true,
  mockGhl: true
};

const lead: Lead = {
  id: "lead-1",
  businessName: "Test Med Spa",
  city: "Irvine",
  state: "CA",
  phone: "949-555-0100",
  source: "unit_test",
  services: ["Botox"],
  visibleWeaknesses: ["No online booking visible"],
  score: 80,
  status: "scored",
  callStatus: "not_called",
  callAttempts: 0,
  optOut: false,
  callLogs: [],
  createdAt: "2026-05-09T12:00:00.000Z",
  updatedAt: "2026-05-09T12:00:00.000Z"
};

describe("call compliance", () => {
  it("allows calls inside configured business hours", () => {
    expect(isWithinCallingHours(new Date("2026-05-09T18:00:00.000Z"), settings)).toBe(true);
  });

  it("blocks calls outside configured business hours", () => {
    expect(isWithinCallingHours(new Date("2026-05-10T03:00:00.000Z"), settings)).toBe(false);
  });

  it("blocks opt-out leads", () => {
    const result = getCallEligibility({ ...lead, optOut: true }, settings, new Date("2026-05-09T18:00:00.000Z"));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Lead has opted out.");
  });

  it("blocks leads at max attempts", () => {
    const result = getCallEligibility({ ...lead, callAttempts: 3 }, settings, new Date("2026-05-09T18:00:00.000Z"));
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("max attempts");
  });

  it("blocks leads below the qualification score threshold", () => {
    const result = getCallEligibility({ ...lead, score: 30 }, settings, new Date("2026-05-09T18:00:00.000Z"));
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("below qualification threshold");
  });
});
