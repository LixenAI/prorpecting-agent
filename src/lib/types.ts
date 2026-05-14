export const leadStatuses = [
  "new_prospect",
  "scored",
  "ai_call_queued",
  "called_no_answer",
  "interested",
  "audit_booked",
  "no_show",
  "proposal_sent",
  "closed_won",
  "closed_lost",
  "do_not_contact"
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export type CallStatus =
  | "not_called"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "interested"
  | "audit_booked"
  | "opted_out";

export type ScoreTier = "Priority A" | "Priority B" | "Priority C" | "Low Priority";

export type ScoreBreakdown = {
  totalScore: number;
  tier: ScoreTier;
  reasons: string[];
  weaknesses: string[];
  recommendedAction: string;
};

export type CallLog = {
  id: string;
  aiCallId?: string;
  status: CallStatus | string;
  summary?: string;
  transcript?: string;
  createdAt: string;
};

export type Lead = {
  id: string;
  businessName: string;
  city: string;
  state: string;
  phone: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  source: string;
  googleRating?: number;
  reviewCount?: number;
  services: string[];
  ownerName?: string;
  managerName?: string;
  visibleWeaknesses: string[];
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  status: LeadStatus;
  callStatus: CallStatus;
  callAttempts: number;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  ghlContactId?: string;
  ghlOpportunityId?: string;
  aiCallId?: string;
  notes?: string;
  optOut: boolean;
  appointmentTime?: string;
  callLogs: CallLog[];
  createdAt: string;
  updatedAt: string;
};

export type LeadInput = Partial<Omit<Lead, "id" | "createdAt" | "updatedAt" | "callLogs" | "services" | "visibleWeaknesses">> & {
  businessName: string;
  phone: string;
  source: string;
  services?: string[] | string;
  visibleWeaknesses?: string[] | string;
};

export type AppSettings = {
  aiCallProvider: "vapi" | "retell" | "bland" | "synthflow" | "woosender" | "manual_webhook";
  dailyCallLimit: number;
  hourlyRateLimit: number;
  qualificationScoreThreshold: number;
  callingTimezone: string;
  callingStartHour: number;
  callingEndHour: number;
  maxCallAttempts: number;
  bookingCalendarUrl?: string;
  makeZapierWebhookUrl?: string;
  ghlPipelineId?: string;
  ghlStageMap: Record<LeadStatus, string | undefined>;
  mockAiCaller: boolean;
  mockGhl: boolean;
};

export type AiCallOutcomePayload = {
  leadId: string;
  aiCallId?: string;
  callStatus?: string;
  transcript?: string;
  summary?: string;
  interested?: boolean;
  appointmentRequested?: boolean;
  appointmentBooked?: boolean;
  appointmentTime?: string;
  emailCaptured?: string;
  phoneConfirmed?: string;
  objections?: string[];
  optOutRequested?: boolean;
};

export type QueueResult = {
  ok: boolean;
  lead?: Lead;
  aiCallId?: string;
  message: string;
  blockedReasons?: string[];
};
