import type {
  QualificationStatus,
  ScoreBreakdown,
  ScoreTier,
  ScoreableLead
} from "./types.js";

const highTicketKeywords = [
  "botox",
  "filler",
  "fillers",
  "laser",
  "morpheus",
  "coolsculpting",
  "body contouring",
  "semaglutide",
  "weight loss",
  "hydrafacial",
  "microneedling",
  "prp",
  "pdo",
  "rf"
];

function textForLead(lead: ScoreableLead): string {
  return [
    ...(lead.visibleWeaknesses ?? []),
    ...(lead.services ?? []),
    lead.website ?? "",
    lead.instagram ?? "",
    lead.notes ?? ""
  ]
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return "Priority A";
  if (score >= 60) return "Priority B";
  if (score >= 40) return "Priority C";
  return "Low Priority";
}

export function getQualificationStatus(
  score: number | null | undefined
): QualificationStatus {
  if (score == null) return "Needs enrichment data";
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Cold";
  return "Unqualified";
}

export function scoreLead(lead: ScoreableLead): ScoreBreakdown {
  const text = textForLead(lead);
  const reasons: string[] = [];
  const weaknesses: string[] = [];
  let totalScore = 0;

  const add = (points: number, reason: string, weakness?: string) => {
    totalScore += points;
    reasons.push(`+${points} ${reason}`);
    if (weakness) weaknesses.push(weakness);
  };

  if (hasAny(text, ["no online booking", "no booking", "booking not visible", "weak booking", "manual booking"])) {
    add(20, "No online booking is visible", "Booking flow appears weak or missing");
  }
  if (hasAny(text, ["slow website", "weak website", "outdated website", "broken website", "poor mobile"])) {
    add(15, "Website appears slow, weak, or outdated", "Website conversion quality may be low");
  }
  if ((lead.reviewCount ?? 0) > 0 && (lead.reviewCount ?? 0) < 50) {
    add(15, "Review count is under 50", "Review volume is still developing");
  }
  if (hasAny(text, ["inactive instagram", "low instagram", "no instagram", "stale instagram", "inconsistent instagram"])) {
    add(10, "Instagram appears inactive or inconsistent", "Social proof and inbound nurture look weak");
  }
  if (hasAny(text, ["no chatbot", "no chat bot", "chatbot missing", "no live chat"])) {
    add(10, "No chatbot is visible", "Website has no immediate lead capture assistant");
  }
  if (hasAny(text, ["no sms", "no sms follow", "manual follow", "no follow-up", "weak follow-up", "missed call"])) {
    add(15, "No SMS follow-up is visible", "Follow-up is likely manual or inconsistent");
  }
  if (hasAny(text, highTicketKeywords)) {
    add(15, "High-ticket aesthetic services are visible");
  }
  if ((lead.googleRating ?? 0) >= 4) {
    add(5, "Google rating is 4.0 or higher");
  }
  if ((lead.reviewCount ?? 0) > 25) {
    add(5, "Review count is over 25");
  }

  totalScore = Math.min(100, totalScore);
  const tier = getScoreTier(totalScore);
  const recommendedAction =
    totalScore >= 80
      ? "Queue for AI call after GHL sync and business-hours check."
      : totalScore >= 60
        ? "Review and queue if public business details are complete."
        : totalScore >= 40
          ? "Nurture or research more before calling."
          : "Keep in database, but do not prioritize for calling.";

  return {
    totalScore,
    tier,
    qualificationStatus: getQualificationStatus(totalScore),
    reasons,
    weaknesses: Array.from(new Set(weaknesses)),
    recommendedAction
  };
}
