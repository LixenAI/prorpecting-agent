import type { AiCallOutcomePayload, AppSettings, Lead, LeadInput, LeadStatus, QueueResult } from "./lib/types";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || `Request failed with ${response.status}`);
  return data;
}

export const api = {
  leads: () => request<Lead[]>("/api/leads"),
  lead: (id: string) => request<Lead>(`/api/leads/${id}`),
  createLead: (lead: LeadInput) => request<Lead>("/api/leads", { method: "POST", body: JSON.stringify(lead) }),
  importCsv: (csvText: string) =>
    request<{ imported: number; skipped: number; leads: Lead[] }>("/api/import/csv", {
      method: "POST",
      body: JSON.stringify({ csvText })
    }),
  scoreLead: (id: string) => request<Lead>(`/api/leads/${id}/score`, { method: "POST" }),
  scoreAll: () => request<{ scored: number; leads: Lead[] }>("/api/leads/score-all", { method: "POST" }),
  queueAiCall: (id: string) => request<QueueResult>(`/api/leads/${id}/queue-ai-call`, { method: "POST" }),
  queueBatch: (leadIds?: string[]) =>
    request<{ queued: number; results: QueueResult[] }>("/api/leads/queue-batch", {
      method: "POST",
      body: JSON.stringify({ leadIds, limit: 10 })
    }),
  syncGhl: (id: string) => request<{ ok: boolean; lead: Lead }>(`/api/leads/${id}/sync-ghl`, { method: "POST" }),
  doNotContact: (id: string, note?: string) =>
    request<Lead>(`/api/leads/${id}/do-not-contact`, { method: "POST", body: JSON.stringify({ note }) }),
  updateStatus: (id: string, status: LeadStatus) =>
    request<Lead>(`/api/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  simulateOutcome: (id: string, payload: Partial<AiCallOutcomePayload>) =>
    request<{ ok: boolean; lead: Lead }>(`/api/leads/${id}/simulate-outcome`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  settings: () => request<AppSettings>("/api/settings"),
  saveSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(settings) })
};
