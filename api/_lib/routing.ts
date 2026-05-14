import { getQualificationStatus, scoreLead } from "./scoring.js";
import type {
  ProspectRouteDecision,
  QualificationStatus,
  ScoreableLead
} from "./types.js";

export type ProspectRouteInput = {
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  services?: string[] | string | null;
  visibleWeaknesses?: string[] | string | null;
  notes?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  source?: string | null;
  tags?: string[] | null;
  leadScore?: number | null;
  qualificationStatus?: QualificationStatus | string | null;
  optOut?: boolean | null;
  status?: string | null;
};

const REQUIRED_FOR_OUTREACH = ["businessName", "city", "website"] as const;

function toList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function findMissingFields(
  input: ProspectRouteInput,
  required: readonly string[] = REQUIRED_FOR_OUTREACH
): string[] {
  return required.filter((field) => {
    const value = (input as Record<string, unknown>)[field];
    if (value == null) return true;
    if (typeof value === "string" && value.trim().length === 0) return true;
    return false;
  });
}

function normalizeQualificationStatus(
  value: ProspectRouteInput["qualificationStatus"]
): QualificationStatus | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "hot") return "Hot";
  if (normalized === "warm") return "Warm";
  if (normalized === "cold") return "Cold";
  if (normalized === "unqualified") return "Unqualified";
  if (normalized === "needs enrichment data" || normalized === "needs_enrichment") {
    return "Needs enrichment data";
  }
  return undefined;
}

function scoreableFromInput(input: ProspectRouteInput): ScoreableLead {
  return {
    services: toList(input.services),
    visibleWeaknesses: toList(input.visibleWeaknesses),
    website: trimOrUndefined(input.website),
    instagram: trimOrUndefined(input.instagram),
    notes: trimOrUndefined(input.notes),
    googleRating: input.googleRating ?? undefined,
    reviewCount: input.reviewCount ?? undefined
  };
}

/**
 * Decide how an inbound prospect (e.g., GHL contact tagged medspa_prospect_ready)
 * should be routed by the Lixen Agent Studio workflow.
 *
 * The function never throws and never blocks on missing fields. Missing
 * business name / city / website routes to General/Status Alignment with a
 * `needs_enrichment_data` tag instead of stopping the workflow to ask a human.
 */
export function routeProspect(input: ProspectRouteInput): ProspectRouteDecision {
  const reasons: string[] = [];
  const tags = new Set<string>();
  const missingFields = findMissingFields(input);

  if (input.optOut || input.status === "do_not_contact") {
    tags.add("do_not_contact");
    return {
      route: "Hold",
      qualificationStatus: "Unqualified",
      leadScore: input.leadScore ?? null,
      needsEnrichment: false,
      missingFields,
      reasons: ["Lead is opted out or marked Do Not Contact."],
      tags: Array.from(tags)
    };
  }

  let leadScore: number | null = input.leadScore ?? null;
  let qualificationStatus =
    normalizeQualificationStatus(input.qualificationStatus) ?? null;

  const hasScoringSignal =
    toList(input.visibleWeaknesses).length > 0 ||
    toList(input.services).length > 0 ||
    Boolean(trimOrUndefined(input.notes)) ||
    (input.googleRating != null && input.reviewCount != null);

  if (leadScore == null && hasScoringSignal) {
    const breakdown = scoreLead(scoreableFromInput(input));
    leadScore = breakdown.totalScore;
    qualificationStatus = qualificationStatus ?? breakdown.qualificationStatus;
    reasons.push(`Computed lead_score=${leadScore} from available enrichment signals.`);
  }

  if (qualificationStatus == null && leadScore != null) {
    qualificationStatus = getQualificationStatus(leadScore);
  }

  const hasExplicitWarmOrHot =
    qualificationStatus === "Hot" || qualificationStatus === "Warm";

  const needsEnrichment =
    missingFields.length > 0 ||
    qualificationStatus === "Needs enrichment data" ||
    (leadScore == null && !hasExplicitWarmOrHot);

  if (needsEnrichment) {
    tags.add("needs_enrichment_data");
    if (missingFields.length) {
      reasons.push(`Missing required fields: ${missingFields.join(", ")}.`);
    }
    if (leadScore == null) {
      reasons.push("No lead_score available; insufficient enrichment data to score.");
    }
    return {
      route: "General/Status Alignment",
      qualificationStatus: qualificationStatus ?? "Needs enrichment data",
      leadScore,
      needsEnrichment: true,
      missingFields,
      reasons,
      tags: Array.from(tags)
    };
  }

  const finalStatus = qualificationStatus ?? getQualificationStatus(leadScore);
  const isQualified =
    (typeof leadScore === "number" && leadScore >= 60) ||
    finalStatus === "Hot" ||
    finalStatus === "Warm";

  if (isQualified) {
    tags.add("medspa_ai_call_queued");
    reasons.push(
      `Lead qualified (score=${leadScore ?? "n/a"}, status=${finalStatus}); routing to Outreach Caller.`
    );
    return {
      route: "Outreach Caller",
      qualificationStatus: finalStatus,
      leadScore,
      needsEnrichment: false,
      missingFields,
      reasons,
      tags: Array.from(tags)
    };
  }

  reasons.push(
    `Lead below qualification threshold (score=${leadScore ?? "n/a"}, status=${finalStatus}); holding without outreach.`
  );
  return {
    route: "Hold",
    qualificationStatus: finalStatus,
    leadScore,
    needsEnrichment: false,
    missingFields,
    reasons,
    tags: Array.from(tags)
  };
}
