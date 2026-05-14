export type QualificationStatus =
  | "Hot"
  | "Warm"
  | "Cold"
  | "Unqualified"
  | "Needs enrichment data";

export type ScoreTier = "Priority A" | "Priority B" | "Priority C" | "Low Priority";

export type ProspectRoute = "Outreach Caller" | "General/Status Alignment" | "Hold";

export type ProspectRouteDecision = {
  route: ProspectRoute;
  qualificationStatus: QualificationStatus;
  leadScore: number | null;
  needsEnrichment: boolean;
  missingFields: string[];
  reasons: string[];
  tags: string[];
};

export type ScoreBreakdown = {
  totalScore: number;
  tier: ScoreTier;
  qualificationStatus: QualificationStatus;
  reasons: string[];
  weaknesses: string[];
  recommendedAction: string;
};

export type ScoreableLead = {
  visibleWeaknesses?: string[];
  services?: string[];
  website?: string;
  instagram?: string;
  notes?: string;
  googleRating?: number;
  reviewCount?: number;
};
