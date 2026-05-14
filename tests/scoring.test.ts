import { describe, expect, it } from "vitest";
import { scoreLead } from "../src/lib/scoring";
import type { Lead } from "../src/lib/types";

const baseLead: Lead = {
  id: "lead-1",
  businessName: "Test Med Spa",
  city: "Irvine",
  state: "CA",
  phone: "949-555-0100",
  source: "unit_test",
  googleRating: 4.7,
  reviewCount: 35,
  services: ["Botox", "Laser resurfacing"],
  visibleWeaknesses: ["No online booking visible", "Slow website", "No chatbot", "No SMS follow-up visible"],
  status: "new_prospect",
  callStatus: "not_called",
  callAttempts: 0,
  optOut: false,
  callLogs: [],
  createdAt: "2026-05-09T12:00:00.000Z",
  updatedAt: "2026-05-09T12:00:00.000Z"
};

describe("scoreLead", () => {
  it("scores pain signals and returns a priority tier", () => {
    const result = scoreLead(baseLead);
    expect(result.totalScore).toBe(100);
    expect(result.tier).toBe("Priority A");
    expect(result.reasons).toContain("+20 No online booking is visible");
  });

  it("keeps low-signal businesses low priority", () => {
    const result = scoreLead({
      ...baseLead,
      googleRating: 3.6,
      reviewCount: 8,
      services: ["Facials"],
      visibleWeaknesses: []
    });
    expect(result.totalScore).toBe(15);
    expect(result.tier).toBe("Low Priority");
  });
});
