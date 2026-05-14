import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import type { AppSettings, Lead, LeadInput } from "../../src/lib/types";
import { scoreLead } from "../../src/lib/scoring";
import { getSettingsFromEnv } from "../config";
import { sampleLeads } from "./sampleLeads";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const leadsPath = path.join(dataDir, "leads.json");
const settingsPath = path.join(dataDir, "settings.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    await writeJson(filePath, fallback);
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDataDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function getLeads() {
  return readJson<Lead[]>(leadsPath, sampleLeads.map((lead) => applyScore(lead)));
}

export async function saveLeads(leads: Lead[]) {
  await writeJson(leadsPath, leads);
}

export async function getLead(id: string) {
  const leads = await getLeads();
  return leads.find((lead) => lead.id === id);
}

export function normalizeLead(input: LeadInput): Lead {
  const now = new Date().toISOString();
  const lead: Lead = {
    id: nanoid(),
    businessName: input.businessName?.trim() ?? "",
    city: input.city?.trim() ?? "",
    state: input.state?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim(),
    website: input.website?.trim(),
    instagram: input.instagram?.trim(),
    facebook: input.facebook?.trim(),
    source: input.source?.trim() ?? "",
    googleRating: input.googleRating == null ? undefined : Number(input.googleRating),
    reviewCount: input.reviewCount == null ? undefined : Number(input.reviewCount),
    services: Array.isArray(input.services) ? input.services : splitList(String(input.services ?? "")),
    ownerName: input.ownerName?.trim(),
    managerName: input.managerName?.trim(),
    visibleWeaknesses: Array.isArray(input.visibleWeaknesses)
      ? input.visibleWeaknesses
      : splitList(String(input.visibleWeaknesses ?? "")),
    status: input.status ?? "new_prospect",
    callStatus: input.callStatus ?? "not_called",
    callAttempts: input.callAttempts ?? 0,
    lastContactedAt: input.lastContactedAt,
    nextFollowUpAt: input.nextFollowUpAt,
    ghlContactId: input.ghlContactId,
    ghlOpportunityId: input.ghlOpportunityId,
    aiCallId: input.aiCallId,
    notes: input.notes,
    optOut: input.optOut ?? false,
    appointmentTime: input.appointmentTime,
    callLogs: [],
    createdAt: now,
    updatedAt: now
  };
  return applyScore(lead);
}

export async function addLead(input: LeadInput) {
  const leads = await getLeads();
  const lead = normalizeLead(input);
  leads.unshift(lead);
  await saveLeads(leads);
  return lead;
}

export async function updateLead(id: string, updater: (lead: Lead) => Lead) {
  const leads = await getLeads();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index < 0) return undefined;
  const updated = updater(leads[index]);
  updated.updatedAt = new Date().toISOString();
  leads[index] = updated;
  await saveLeads(leads);
  return updated;
}

export async function getSettings() {
  const envSettings = getSettingsFromEnv();
  const saved = await readJson<Partial<AppSettings>>(settingsPath, {});
  return {
    ...envSettings,
    ...saved,
    ghlStageMap: {
      ...envSettings.ghlStageMap,
      ...(saved.ghlStageMap ?? {})
    },
    mockAiCaller: envSettings.mockAiCaller,
    mockGhl: envSettings.mockGhl
  };
}

export async function saveSettings(settings: Partial<AppSettings>) {
  const current = await getSettings();
  const safeSettings: AppSettings = {
    ...current,
    ...settings,
    mockAiCaller: current.mockAiCaller,
    mockGhl: current.mockGhl
  };
  await writeJson(settingsPath, safeSettings);
  return safeSettings;
}

export function applyScore(lead: Lead): Lead {
  const scoreBreakdown = scoreLead(lead);
  return {
    ...lead,
    score: scoreBreakdown.totalScore,
    scoreBreakdown,
    status: lead.status === "new_prospect" ? "scored" : lead.status
  };
}

function splitList(value: string) {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
