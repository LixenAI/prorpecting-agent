import cors from "cors";
import express from "express";
import Papa from "papaparse";
import type { Lead, LeadInput, LeadStatus } from "../src/lib/types";
import { leadStatuses } from "../src/lib/types";
import { applyScore, addLead, getLead, getLeads, getSettings, normalizeLead, saveLeads, saveSettings, updateLead } from "./data/store";
import { queueAiCall } from "./services/aiCaller";
import { syncLeadToGhl } from "./services/ghl";
import { handleAiCallOutcome } from "./services/outcomes";
import { routeProspect, type ProspectRouteInput } from "../src/lib/routing";

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Lixen AI Med Spa Prospecting Agent" });
});

app.get("/api/leads", async (_req, res) => {
  res.json(await getLeads());
});

app.get("/api/leads/:id", async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found." });
  res.json(lead);
});

app.post("/api/leads", async (req, res) => {
  try {
    const lead = await addLead(req.body as LeadInput);
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: "Unable to create lead.", error: String(error) });
  }
});

app.patch("/api/leads/:id", async (req, res) => {
  const updated = await updateLead(req.params.id, (lead) => applyScore({ ...lead, ...req.body }));
  if (!updated) return res.status(404).json({ message: "Lead not found." });
  res.json(updated);
});

app.post("/api/import/csv", async (req, res) => {
  const csvText = String(req.body.csvText ?? "");
  if (!csvText.trim()) return res.status(400).json({ message: "csvText is required." });

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase()
  });

  if (parsed.errors.length) {
    return res.status(400).json({ message: "CSV parse failed.", errors: parsed.errors });
  }

  const leads = await getLeads();
  const imported = parsed.data
    .map(mapCsvRowToLeadInput)
    .filter((lead) => lead.businessName && lead.phone && lead.source)
    .map(normalizeLead);

  await saveLeads([...imported, ...leads]);
  res.json({ imported: imported.length, skipped: parsed.data.length - imported.length, leads: imported });
});

app.post("/api/import/google-sheet", async (req, res) => {
  const { sheetId } = req.body as { sheetId?: string };
  if (!sheetId) return res.status(400).json({ message: "sheetId is required." });
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return res.status(501).json({
      message:
        "Google Sheets import endpoint is ready, but credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY or import CSV for the MVP."
    });
  }
  res.status(501).json({
    message:
      "Google Sheets credential plumbing is intentionally externalized. Connect the Sheets API client here after adding service account credentials."
  });
});

app.post("/api/leads/:id/score", async (req, res) => {
  const updated = await updateLead(req.params.id, (lead) => applyScore(lead));
  if (!updated) return res.status(404).json({ message: "Lead not found." });
  res.json(updated);
});

app.post("/api/leads/score-all", async (_req, res) => {
  const leads = (await getLeads()).map(applyScore);
  await saveLeads(leads);
  res.json({ scored: leads.length, leads });
});

app.post("/api/leads/:id/queue-ai-call", async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found." });
  const result = await queueAiCall(lead, await getSettings());
  res.status(result.ok ? 200 : 409).json(result);
});

app.post("/api/leads/queue-batch", async (req, res) => {
  const settings = await getSettings();
  const leads = await getLeads();
  const requestedIds = new Set<string>(req.body.leadIds ?? []);
  const limit = Number(req.body.limit ?? 10);
  const candidates = leads
    .filter((lead) => (requestedIds.size ? requestedIds.has(lead.id) : true))
    .filter((lead) => lead.scoreBreakdown?.tier === "Priority A" || (lead.score ?? 0) >= settings.qualificationScoreThreshold)
    .slice(0, limit);
  const results = [];
  for (const lead of candidates) {
    results.push(await queueAiCall(lead, settings));
  }
  res.json({ queued: results.filter((result) => result.ok).length, results });
});

app.post("/api/leads/:id/sync-ghl", async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found." });
  const result = await syncLeadToGhl(lead, await getSettings());
  if (result.ok) {
    const updated = await updateLead(lead.id, (current) => ({
      ...current,
      ghlContactId: result.contactId || current.ghlContactId,
      ghlOpportunityId: result.opportunityId || current.ghlOpportunityId
    }));
    return res.json({ ...result, lead: updated });
  }
  res.status(502).json(result);
});

app.post("/api/route-prospect", (req, res) => {
  const input = (req.body ?? {}) as ProspectRouteInput;
  const decision = routeProspect(input);
  res.json(decision);
});

app.post("/api/ai-call/outcome", async (req, res) => {
  const result = await handleAiCallOutcome(req.body, await getSettings());
  res.status(result.ok ? 200 : 404).json(result);
});

app.post("/api/leads/:id/simulate-outcome", async (req, res) => {
  const result = await handleAiCallOutcome({ leadId: req.params.id, ...req.body }, await getSettings());
  res.status(result.ok ? 200 : 404).json(result);
});

app.post("/api/leads/:id/do-not-contact", async (req, res) => {
  const updated = await updateLead(req.params.id, (lead) => ({
    ...lead,
    optOut: true,
    status: "do_not_contact",
    callStatus: "opted_out",
    notes: [lead.notes, req.body?.note || "Manually marked Do Not Contact."].filter(Boolean).join("\n")
  }));
  if (!updated) return res.status(404).json({ message: "Lead not found." });
  await syncLeadToGhl(updated, await getSettings(), "do_not_contact");
  res.json(updated);
});

app.patch("/api/leads/:id/status", async (req, res) => {
  const status = req.body.status as LeadStatus;
  if (!leadStatuses.includes(status)) return res.status(400).json({ message: "Invalid lead status." });
  const updated = await updateLead(req.params.id, (lead) => ({ ...lead, status }));
  if (!updated) return res.status(404).json({ message: "Lead not found." });
  res.json(updated);
});

app.get("/api/export/leads", async (_req, res) => {
  const leads = await getLeads();
  const csv = Papa.unparse(
    leads.map((lead) => ({
      id: lead.id,
      businessName: lead.businessName,
      city: lead.city,
      state: lead.state,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      instagram: lead.instagram,
      facebook: lead.facebook,
      source: lead.source,
      googleRating: lead.googleRating,
      reviewCount: lead.reviewCount,
      services: lead.services.join("; "),
      visibleWeaknesses: lead.visibleWeaknesses.join("; "),
      score: lead.score,
      tier: lead.scoreBreakdown?.tier,
      status: lead.status,
      callStatus: lead.callStatus,
      callAttempts: lead.callAttempts,
      optOut: lead.optOut
    }))
  );
  res.header("Content-Type", "text/csv");
  res.attachment("lixen-medspa-leads.csv");
  res.send(csv);
});

app.get("/api/settings", async (_req, res) => {
  res.json(await getSettings());
});

app.patch("/api/settings", async (req, res) => {
  res.json(await saveSettings(req.body));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api:error]", error);
  res.status(500).json({ message: "Unexpected server error.", error: String(error) });
});

app.listen(port, () => {
  console.info(`Lixen AI Med Spa Prospecting Agent API listening on http://localhost:${port}`);
});

function mapCsvRowToLeadInput(row: Record<string, string>): LeadInput {
  const get = (...keys: string[]) => keys.map((key) => row[key.toLowerCase()]?.trim()).find(Boolean) ?? "";
  const ownerOrManager = get("owner/manager name", "owner manager name", "owner name", "manager name");
  return {
    businessName: get("business name", "businessname", "company", "company name"),
    city: get("city"),
    state: get("state"),
    phone: get("phone", "business phone"),
    email: get("email", "business email"),
    website: get("website", "site"),
    instagram: get("instagram", "ig"),
    facebook: get("facebook", "fb"),
    source: get("source") || "csv_import",
    googleRating: Number(get("google rating", "googlerating")) || undefined,
    reviewCount: Number(get("review count", "reviewcount", "reviews")) || undefined,
    services: get("services"),
    ownerName: ownerOrManager,
    managerName: ownerOrManager,
    visibleWeaknesses: get("visible weaknesses", "visibleweaknesses", "weaknesses"),
    notes: get("notes")
  };
}
