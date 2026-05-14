import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileUp,
  Gauge,
  Globe,
  Hand,
  ListChecks,
  PhoneCall,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  UserPlus,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { defaultCallScript } from "./lib/callScript";
import type { AppSettings, Lead, LeadInput, LeadStatus } from "./lib/types";

type Toast = { type: "success" | "error" | "info"; message: string } | null;

const navItems = [
  { label: "Dashboard", path: "/medspa-prospecting", icon: Gauge },
  { label: "Leads", path: "/medspa-prospecting/leads", icon: Users },
  { label: "Import", path: "/medspa-prospecting/import", icon: FileUp },
  { label: "Call Queue", path: "/medspa-prospecting/call-queue", icon: PhoneCall },
  { label: "Settings", path: "/medspa-prospecting/settings", icon: Settings }
];

const emptyLeadInput: LeadInput = {
  businessName: "",
  city: "",
  state: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  source: "manual_entry",
  services: [],
  visibleWeaknesses: []
};

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [leadData, settingsData] = await Promise.all([api.leads(), api.settings()]);
      setLeads(leadData);
      setSettings(settingsData);
    } catch (error) {
      setToast({ type: "error", message: String(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onRoute);
    void refresh();
    return () => window.removeEventListener("popstate", onRoute);
  }, []);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setToast({ type: "success", message: success });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: String(error) });
    }
  };

  const leadIdMatch = route.match(/^\/medspa-prospecting\/leads\/([^/]+)$/);
  const activeLead = leadIdMatch ? leads.find((lead) => lead.id === leadIdMatch[1]) : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LX</div>
          <div>
            <strong>Lixen AI</strong>
            <span>Med Spa Prospecting</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = route === item.path || (item.path.endsWith("/leads") && route.startsWith("/medspa-prospecting/leads"));
            return (
              <a
                className={active ? "nav-item active" : "nav-item"}
                href={item.path}
                key={item.path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.path);
                }}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="guardrail">
          <ShieldCheck size={18} />
          <span>B2B public business outreach only. Opt-outs and Do Not Contact are always blocked.</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Lixen AI Med Spa Prospecting Agent</h1>
            <p>Score prospects, queue qualified AI calls, sync GHL, and track audit bookings.</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={refresh} title="Refresh data">
              <RefreshCw size={18} />
            </button>
            <a className="button secondary" href="/api/export/leads">
              <Download size={17} />
              Export CSV
            </a>
          </div>
        </header>

        {toast && (
          <div className={`toast ${toast.type}`} onClick={() => setToast(null)}>
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading prospecting workspace...</div>
        ) : (
          <>
            {route === "/" && <RedirectNotice />}
            {route === "/medspa-prospecting" && (
              <Dashboard leads={leads} onAction={runAction} settings={settings} />
            )}
            {route === "/medspa-prospecting/leads" && <LeadsPage leads={leads} onAction={runAction} />}
            {activeLead && <LeadDetail lead={activeLead} onAction={runAction} />}
            {route === "/medspa-prospecting/import" && <ImportPage onAction={runAction} />}
            {route === "/medspa-prospecting/call-queue" && <CallQueue leads={leads} onAction={runAction} settings={settings} />}
            {route === "/medspa-prospecting/settings" && settings && (
              <SettingsPage settings={settings} onSaved={async () => refresh()} setToast={setToast} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function RedirectNotice() {
  useEffect(() => navigate("/medspa-prospecting"), []);
  return <div className="empty-state">Opening dashboard...</div>;
}

function Dashboard({ leads, onAction, settings }: { leads: Lead[]; onAction: (a: () => Promise<unknown>, s: string) => void; settings: AppSettings | null }) {
  const metrics = useMemo(
    () => [
      { label: "Total leads", value: leads.length, icon: Users },
      { label: "Priority A", value: leads.filter((lead) => lead.scoreBreakdown?.tier === "Priority A").length, icon: Gauge },
      { label: "AI Call Queued", value: leads.filter((lead) => lead.status === "ai_call_queued").length, icon: Bot },
      { label: "Interested", value: leads.filter((lead) => lead.status === "interested").length, icon: CheckCircle2 },
      { label: "Audit Booked", value: leads.filter((lead) => lead.status === "audit_booked").length, icon: CalendarCheck },
      { label: "Do Not Contact", value: leads.filter((lead) => lead.status === "do_not_contact" || lead.optOut).length, icon: Hand }
    ],
    [leads]
  );
  const recentLogs = leads
    .flatMap((lead) => lead.callLogs.map((log) => ({ ...log, businessName: lead.businessName })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <section className="page-grid">
      <div className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="metric" key={metric.label}>
              <Icon size={18} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          );
        })}
      </div>

      <div className="panel two-col">
        <div>
          <h2>Best prospects</h2>
          <p className="muted">Priority leads with public business contact data and score-ready weaknesses.</p>
        </div>
        <div className="action-row end">
          <button className="button secondary" onClick={() => onAction(() => api.scoreAll(), "All leads scored.")}>
            <ListChecks size={17} />
            Score all
          </button>
          <button className="button" onClick={() => onAction(() => api.queueBatch(), "Batch queue complete.")}>
            <PhoneCall size={17} />
            Queue top leads
          </button>
        </div>
      </div>
      <LeadTable leads={leads.slice(0, 8)} onAction={onAction} compact />

      <div className="split">
        <div className="panel">
          <h2>Recent call outcomes</h2>
          {recentLogs.length ? (
            <div className="timeline">
              {recentLogs.map((log) => (
                <div className="timeline-row" key={log.id}>
                  <strong>{log.businessName}</strong>
                  <span>{log.status}</span>
                  <p>{log.summary || "No summary yet."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No call outcomes yet. Mock calls can be simulated from a lead detail page.</div>
          )}
        </div>
        <div className="panel">
          <h2>Compliance guardrails</h2>
          <ul className="checklist">
            <li>Only public B2B med spa contacts are eligible.</li>
            <li>Opt-out and Do Not Contact leads are blocked before queueing.</li>
            <li>Max attempts: {settings?.maxCallAttempts ?? 3}; daily limit: {settings?.dailyCallLimit ?? 50}.</li>
            <li>Allowed hours: {settings?.callingStartHour}:00-{settings?.callingEndHour}:00 {settings?.callingTimezone}.</li>
            <li>Ava must identify Lixen AI and truthfully disclose AI status if asked.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function LeadsPage({ leads, onAction }: { leads: Lead[]; onAction: (a: () => Promise<unknown>, s: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = leads.filter((lead) =>
    [lead.businessName, lead.city, lead.state, lead.phone, lead.status, lead.scoreBreakdown?.tier]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <section className="page-grid">
      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, city, status, tier" />
        </label>
        <button className="button secondary" onClick={() => navigate("/medspa-prospecting/import")}>
          <UserPlus size={17} />
          Add leads
        </button>
      </div>
      <LeadTable leads={filtered} onAction={onAction} />
    </section>
  );
}

function LeadTable({ leads, onAction, compact = false }: { leads: Lead[]; onAction: (a: () => Promise<unknown>, s: string) => void; compact?: boolean }) {
  if (!leads.length) return <div className="empty-state">No leads match this view.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>City</th>
            <th>Phone</th>
            <th>Website</th>
            <th>Score</th>
            <th>Tier</th>
            <th>Status</th>
            <th>Call Status</th>
            {!compact && <th>Last Contacted</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <button className="link-button" onClick={() => navigate(`/medspa-prospecting/leads/${lead.id}`)}>
                  {lead.businessName}
                </button>
              </td>
              <td>{[lead.city, lead.state].filter(Boolean).join(", ")}</td>
              <td>{lead.phone}</td>
              <td>
                {lead.website ? (
                  <a className="inline-link" href={lead.website} target="_blank" rel="noreferrer">
                    <Globe size={15} />
                    Open
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td>{lead.score ?? "—"}</td>
              <td>
                <span className={`tier ${tierClass(lead.scoreBreakdown?.tier)}`}>{lead.scoreBreakdown?.tier ?? "Unscored"}</span>
              </td>
              <td>{humanize(lead.status)}</td>
              <td>{humanize(lead.callStatus)}</td>
              {!compact && <td>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"}</td>}
              <td>
                <div className="table-actions">
                  <button title="Score lead" onClick={() => onAction(() => api.scoreLead(lead.id), "Lead scored.")}>
                    <Gauge size={16} />
                  </button>
                  <button title="Queue AI call" onClick={() => onAction(() => api.queueAiCall(lead.id), "AI call queued.")}>
                    <PhoneCall size={16} />
                  </button>
                  <button title="Sync to GHL" onClick={() => onAction(() => api.syncGhl(lead.id), "Lead synced to GHL.")}>
                    <RefreshCw size={16} />
                  </button>
                  <button title="Mark interested" onClick={() => onAction(() => api.updateStatus(lead.id, "interested"), "Lead marked interested.")}>
                    <CheckCircle2 size={16} />
                  </button>
                  <button title="Do Not Contact" onClick={() => onAction(() => api.doNotContact(lead.id), "Lead marked Do Not Contact.")}>
                    <Hand size={16} />
                  </button>
                  {lead.instagram && (
                    <a title="Open Instagram" href={lead.instagram} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadDetail({ lead, onAction }: { lead: Lead; onAction: (a: () => Promise<unknown>, s: string) => void }) {
  return (
    <section className="page-grid">
      <div className="panel lead-hero">
        <div>
          <button className="link-button back" onClick={() => navigate("/medspa-prospecting/leads")}>
            Back to leads
          </button>
          <h2>{lead.businessName}</h2>
          <p className="muted">
            {[lead.city, lead.state].filter(Boolean).join(", ")} · {lead.phone} · {lead.source}
          </p>
        </div>
        <div className="score-badge">
          <span>{lead.scoreBreakdown?.tier ?? "Unscored"}</span>
          <strong>{lead.score ?? "—"}</strong>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h3>Scoring breakdown</h3>
          <ul className="reason-list">
            {lead.scoreBreakdown?.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <p className="recommendation">{lead.scoreBreakdown?.recommendedAction}</p>
          <div className="action-row">
            <button className="button secondary" onClick={() => onAction(() => api.scoreLead(lead.id), "Lead rescored.")}>
              <Gauge size={17} />
              Score lead
            </button>
            <button className="button" onClick={() => onAction(() => api.queueAiCall(lead.id), "AI call queued.")}>
              <PhoneCall size={17} />
              Queue AI call
            </button>
            <button className="button secondary" onClick={() => onAction(() => api.syncGhl(lead.id), "Lead synced to GHL.")}>
              <RefreshCw size={17} />
              Sync GHL
            </button>
            <button className="button danger" onClick={() => onAction(() => api.doNotContact(lead.id), "Lead marked Do Not Contact.")}>
              <Hand size={17} />
              Do Not Contact
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>AI call script</h3>
          <p className="script-text">{defaultCallScript.opening}</p>
          <p className="script-text">{defaultCallScript.qualificationQuestion}</p>
          <p className="muted">AI disclosure: {defaultCallScript.aiDisclosure}</p>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h3>Manual outcome simulation</h3>
          <div className="action-row">
            <button
              className="button secondary"
              onClick={() =>
                onAction(
                  () => api.simulateOutcome(lead.id, { interested: true, summary: "Owner is interested in a free lead-loss audit." }),
                  "Outcome saved as interested."
                )
              }
            >
              Mark interested
            </button>
            <button
              className="button secondary"
              onClick={() =>
                onAction(
                  () =>
                    api.simulateOutcome(lead.id, {
                      appointmentBooked: true,
                      appointmentTime: new Date(Date.now() + 86400000).toISOString(),
                      summary: "Audit booked from mock call."
                    }),
                  "Outcome saved as audit booked."
                )
              }
            >
              Audit booked
            </button>
            <button
              className="button secondary"
              onClick={() => onAction(() => api.simulateOutcome(lead.id, { callStatus: "no_answer", summary: "No answer." }), "No-answer outcome saved.")}
            >
              No answer
            </button>
            <button
              className="button danger"
              onClick={() =>
                onAction(() => api.simulateOutcome(lead.id, { optOutRequested: true, summary: "Lead requested no further contact." }), "Opt-out saved.")
              }
            >
              Opt-out
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Lead details</h3>
          <dl className="details">
            <div><dt>Website</dt><dd>{lead.website || "—"}</dd></div>
            <div><dt>Instagram</dt><dd>{lead.instagram || "—"}</dd></div>
            <div><dt>Services</dt><dd>{lead.services.join(", ") || "—"}</dd></div>
            <div><dt>Weaknesses</dt><dd>{lead.visibleWeaknesses.join(", ") || "—"}</dd></div>
            <div><dt>GHL Contact</dt><dd>{lead.ghlContactId || "—"}</dd></div>
            <div><dt>GHL Opportunity</dt><dd>{lead.ghlOpportunityId || "—"}</dd></div>
            <div><dt>AI Call</dt><dd>{lead.aiCallId || "—"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="panel">
        <h3>Call log</h3>
        {lead.callLogs.length ? (
          <div className="timeline">
            {lead.callLogs.map((log) => (
              <div className="timeline-row" key={log.id}>
                <strong>{humanize(log.status)}</strong>
                <span>{new Date(log.createdAt).toLocaleString()}</span>
                <p>{log.summary || log.transcript || "No summary captured."}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No calls logged yet.</div>
        )}
      </div>
    </section>
  );
}

function ImportPage({ onAction }: { onAction: (a: () => Promise<unknown>, s: string) => void }) {
  const [csvText, setCsvText] = useState("");
  const [manual, setManual] = useState<LeadInput>(emptyLeadInput);

  return (
    <section className="split">
      <div className="panel">
        <h2>CSV import</h2>
        <p className="muted">Supported columns: Business Name, City, State, Phone, Website, Instagram, Facebook, Google Rating, Review Count, Services, Owner/Manager Name, Visible Weaknesses, Source.</p>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder="Business Name,City,State,Phone,Website,Instagram,Google Rating,Review Count,Services,Visible Weaknesses,Source"
        />
        <button className="button" onClick={() => onAction(() => api.importCsv(csvText), "CSV imported.")}>
          <Upload size={17} />
          Import CSV
        </button>
      </div>
      <div className="panel">
        <h2>Manual lead entry</h2>
        <div className="form-grid">
          {(["businessName", "city", "state", "phone", "email", "website", "instagram", "source"] as const).map((key) => (
            <label key={key}>
              {humanize(key)}
              <input
                value={String(manual[key] ?? "")}
                onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))}
              />
            </label>
          ))}
          <label>
            Services
            <input value={String(manual.services ?? "")} onChange={(event) => setManual((current) => ({ ...current, services: event.target.value.split(";") }))} />
          </label>
          <label>
            Visible weaknesses
            <input
              value={String(manual.visibleWeaknesses ?? "")}
              onChange={(event) => setManual((current) => ({ ...current, visibleWeaknesses: event.target.value.split(";") }))}
            />
          </label>
        </div>
        <button className="button" onClick={() => onAction(() => api.createLead(manual), "Lead added.")}>
          <UserPlus size={17} />
          Add lead
        </button>
      </div>
    </section>
  );
}

function CallQueue({ leads, onAction, settings }: { leads: Lead[]; onAction: (a: () => Promise<unknown>, s: string) => void; settings: AppSettings | null }) {
  const queued = leads.filter((lead) => lead.status === "ai_call_queued" || lead.callStatus === "queued");
  const eligible = leads.filter((lead) => (lead.score ?? 0) >= (settings?.qualificationScoreThreshold ?? 60) && !lead.optOut && lead.status !== "do_not_contact");
  return (
    <section className="page-grid">
      <div className="panel two-col">
        <div>
          <h2>Qualified call queue</h2>
          <p className="muted">{eligible.length} leads meet the score threshold before business-hours and rate-limit checks.</p>
        </div>
        <button className="button" onClick={() => onAction(() => api.queueBatch(eligible.map((lead) => lead.id)), "Qualified leads queued.")}>
          <PhoneCall size={17} />
          Queue qualified batch
        </button>
      </div>
      <LeadTable leads={queued.length ? queued : eligible} onAction={onAction} />
    </section>
  );
}

function SettingsPage({ settings, onSaved, setToast }: { settings: AppSettings; onSaved: () => Promise<void>; setToast: (toast: Toast) => void }) {
  const [draft, setDraft] = useState(settings);
  const save = async () => {
    try {
      await api.saveSettings(draft);
      setToast({ type: "success", message: "Settings saved. Secret keys stay in environment variables." });
      await onSaved();
    } catch (error) {
      setToast({ type: "error", message: String(error) });
    }
  };
  return (
    <section className="page-grid">
      <div className="panel two-col">
        <div>
          <h2>Settings</h2>
          <p className="muted">Operational settings only. API keys, access tokens, and service account secrets are never exposed here.</p>
        </div>
        <button className="button" onClick={save}>
          <Save size={17} />
          Save settings
        </button>
      </div>
      <div className="split">
        <div className="panel">
          <h3>AI caller</h3>
          <div className="form-grid">
            <label>
              Provider
              <select value={draft.aiCallProvider} onChange={(event) => setDraft({ ...draft, aiCallProvider: event.target.value as AppSettings["aiCallProvider"] })}>
                {["manual_webhook", "vapi", "retell", "bland", "synthflow", "woosender"].map((provider) => (
                  <option key={provider}>{provider}</option>
                ))}
              </select>
            </label>
            <NumberField label="Daily call limit" value={draft.dailyCallLimit} onChange={(value) => setDraft({ ...draft, dailyCallLimit: value })} />
            <NumberField label="Hourly rate limit" value={draft.hourlyRateLimit} onChange={(value) => setDraft({ ...draft, hourlyRateLimit: value })} />
            <NumberField label="Qualification score threshold" value={draft.qualificationScoreThreshold} onChange={(value) => setDraft({ ...draft, qualificationScoreThreshold: value })} />
          </div>
        </div>
        <div className="panel">
          <h3>Calling hours and follow-up</h3>
          <div className="form-grid">
            <label>
              Calling timezone
              <input value={draft.callingTimezone} onChange={(event) => setDraft({ ...draft, callingTimezone: event.target.value })} />
            </label>
            <NumberField label="Start hour" value={draft.callingStartHour} onChange={(value) => setDraft({ ...draft, callingStartHour: value })} />
            <NumberField label="End hour" value={draft.callingEndHour} onChange={(value) => setDraft({ ...draft, callingEndHour: value })} />
            <NumberField label="Max call attempts" value={draft.maxCallAttempts} onChange={(value) => setDraft({ ...draft, maxCallAttempts: value })} />
            <label>
              Booking calendar URL
              <input value={draft.bookingCalendarUrl ?? ""} onChange={(event) => setDraft({ ...draft, bookingCalendarUrl: event.target.value })} />
            </label>
            <label>
              Make/Zapier webhook URL
              <input value={draft.makeZapierWebhookUrl ?? ""} onChange={(event) => setDraft({ ...draft, makeZapierWebhookUrl: event.target.value })} />
            </label>
          </div>
        </div>
      </div>
      <div className="panel">
        <h3>GHL stage mapping</h3>
        <div className="stage-grid">
          {Object.entries(draft.ghlStageMap).map(([status, value]) => (
            <label key={status}>
              {humanize(status)}
              <input
                value={value ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    ghlStageMap: { ...draft.ghlStageMap, [status]: event.target.value }
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tierClass(tier?: string) {
  if (tier === "Priority A") return "a";
  if (tier === "Priority B") return "b";
  if (tier === "Priority C") return "c";
  return "low";
}
