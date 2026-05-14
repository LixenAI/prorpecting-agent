import { describe, expect, it } from "vitest";
import { findMissingFields, routeProspect } from "../src/lib/routing";

describe("routeProspect", () => {
  it("routes a Hot lead with a precomputed score >=60 to Outreach Caller", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      leadScore: 82
    });
    expect(decision.route).toBe("Outreach Caller");
    expect(decision.qualificationStatus).toBe("Hot");
    expect(decision.needsEnrichment).toBe(false);
    expect(decision.tags).toContain("medspa_ai_call_queued");
  });

  it("routes a Warm qualificationStatus to Outreach Caller even without a numeric score", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      qualificationStatus: "Warm",
      leadScore: 65
    });
    expect(decision.route).toBe("Outreach Caller");
    expect(decision.qualificationStatus).toBe("Warm");
  });

  it("never asks the human for missing business/city/website; routes to General/Status Alignment", () => {
    const decision = routeProspect({
      businessName: "",
      city: undefined,
      website: null
    });
    expect(decision.route).toBe("General/Status Alignment");
    expect(decision.needsEnrichment).toBe(true);
    expect(decision.missingFields).toEqual(["businessName", "city", "website"]);
    expect(decision.tags).toContain("needs_enrichment_data");
  });

  it("flags missing data when score is absent even with full identity fields", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example"
    });
    expect(decision.route).toBe("General/Status Alignment");
    expect(decision.needsEnrichment).toBe(true);
    expect(decision.qualificationStatus).toBe("Needs enrichment data");
  });

  it("computes a score from enrichment signals when leadScore is missing", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      visibleWeaknesses: "No online booking; slow website; no chatbot; no SMS follow-up",
      services: "Botox; Laser; Morpheus",
      googleRating: 4.5,
      reviewCount: 30
    });
    expect(decision.leadScore).not.toBeNull();
    expect(decision.leadScore!).toBeGreaterThanOrEqual(60);
    expect(decision.route).toBe("Outreach Caller");
  });

  it("holds (does not call) when score is below 60", () => {
    const decision = routeProspect({
      businessName: "Quiet Spa",
      city: "Anywhere",
      website: "https://quietspa.example",
      leadScore: 35
    });
    expect(decision.route).toBe("Hold");
    expect(decision.qualificationStatus).toBe("Unqualified");
    expect(decision.tags).not.toContain("medspa_ai_call_queued");
  });

  it("holds opt-out / do_not_contact leads regardless of score", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      leadScore: 95,
      optOut: true
    });
    expect(decision.route).toBe("Hold");
    expect(decision.tags).toContain("do_not_contact");
  });

  it("accepts an explicit Hot/Warm qualificationStatus without a numeric score", () => {
    const decision = routeProspect({
      businessName: "Glow Med Spa",
      city: "Irvine",
      website: "https://glowmedspa.example",
      qualificationStatus: "Hot"
    });
    expect(decision.route).toBe("Outreach Caller");
    expect(decision.qualificationStatus).toBe("Hot");
  });

  it("findMissingFields returns the list of empty required fields", () => {
    expect(
      findMissingFields({ businessName: "Glow", city: "", website: undefined })
    ).toEqual(["city", "website"]);
  });
});
