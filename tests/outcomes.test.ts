import { describe, expect, it } from "vitest";
import { applyOutcomeToLead } from "../server/services/outcomes";
import type { Lead } from "../src/lib/types";

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
  status: "ai_call_queued",
  callStatus: "queued",
  callAttempts: 1,
  optOut: false,
  callLogs: [],
  createdAt: "2026-05-09T12:00:00.000Z",
  updatedAt: "2026-05-09T12:00:00.000Z"
};

describe("AI call outcome handling", () => {
  it("moves interested leads to interested status", () => {
    const result = applyOutcomeToLead(lead, { leadId: lead.id, interested: true, summary: "Wants audit." }, { maxCallAttempts: 3 });
    expect(result.status).toBe("interested");
    expect(result.callStatus).toBe("interested");
    expect(result.callLogs[0].summary).toBe("Wants audit.");
  });

  it("stores opt-out requests and marks do not contact", () => {
    const result = applyOutcomeToLead(lead, { leadId: lead.id, optOutRequested: true }, { maxCallAttempts: 3 });
    expect(result.optOut).toBe(true);
    expect(result.status).toBe("do_not_contact");
    expect(result.callStatus).toBe("opted_out");
  });

  it("schedules retry after no answer while under max attempts", () => {
    const result = applyOutcomeToLead(lead, { leadId: lead.id, callStatus: "no_answer" }, { maxCallAttempts: 3 });
    expect(result.status).toBe("called_no_answer");
    expect(result.nextFollowUpAt).toBeTruthy();
  });
});
