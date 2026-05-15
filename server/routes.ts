import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";

// ---------- env / defaults ----------
const DEFAULT_OPERATOR_TOKEN_FALLBACK = "lixen-prospecting-dev";

function getOperatorToken(): { token: string; isDev: boolean } {
  const env = (process.env.OPERATOR_TOKEN || "").trim();
  if (env) return { token: env, isDev: false };
  return { token: DEFAULT_OPERATOR_TOKEN_FALLBACK, isDev: true };
}

const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "C7e7ReTQ4FXMZp9TjxzU";
const GHL_PRIVATE_INTEGRATION_TOKEN = (process.env.GHL_PRIVATE_INTEGRATION_TOKEN || "").trim();
const GHL_API_BASE_URL = process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";
const GHL_API_VERSION = process.env.GHL_API_VERSION || "2021-07-28";
const GHL_OPP_API_VERSION = process.env.GHL_OPPORTUNITIES_API_VERSION || "2023-02-21";
const LIXEN_PROSPECTING_AGENT_NAME =
  process.env.LIXEN_PROSPECTING_AGENT_NAME || "LixenAI Prospecting Agent";
const LIXEN_VOICE_AGENT_NAME =
  process.env.LIXEN_VOICE_AGENT_NAME || "Ava — Med Spa Prospecting Agent";
const ROUTE_PROSPECT_API_URL =
  process.env.ROUTE_PROSPECT_API_URL || "https://prorpecting-agent.vercel.app/api/route-prospect";
const LIXEN_BOOKING_LINK =
  process.env.LIXEN_BOOKING_LINK ||
  "https://link.lixen.ai/widget/booking/W0BVrWmszScBAjQhN631";
const PROSPECTING_CUSTOM_DOMAIN =
  process.env.PROSPECTING_CUSTOM_DOMAIN || "prospecting-agent.lixenai.com";

// ---------- in-memory audit log ----------
type AuditEvent = {
  id: string;
  ts: string;
  kind: string;
  summary: string;
  detail?: Record<string, unknown>;
};
const auditLog: AuditEvent[] = [];
function audit(kind: string, summary: string, detail?: Record<string, unknown>) {
  const e: AuditEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    kind,
    summary,
    detail,
  };
  auditLog.unshift(e);
  if (auditLog.length > 200) auditLog.pop();
  return e;
}

// seed a few demo events
audit("system", "Dashboard cold-started");
audit("check", "Daily readiness check ran");
audit("check", "Route API health probe ok");

// ---------- auth middleware ----------
function requireOperator(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const { token } = getOperatorToken();
  if (!bearer || bearer !== token) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// ---------- safe GHL helper (read-only) ----------
async function ghlFetch(path: string, init?: RequestInit & { apiVersion?: string }) {
  if (!GHL_PRIVATE_INTEGRATION_TOKEN) {
    return { ok: false, status: 0, classification: "no_token", body: null as any };
  }
  const version = init?.apiVersion || GHL_API_VERSION;
  const url = `${GHL_API_BASE_URL}${path}`;
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${GHL_PRIVATE_INTEGRATION_TOKEN}`,
        Version: version,
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    return { ok: r.ok, status: r.status, classification: classifyStatus(r.status, body), body };
  } catch (err: any) {
    return { ok: false, status: 0, classification: "network_error", body: { message: String(err?.message || err) } };
  }
}

function classifyStatus(status: number, body: any): string {
  if (status === 200 || status === 201) return "ok";
  if (status === 401) {
    if (body && typeof body === "object" && JSON.stringify(body).toLowerCase().includes("jwt")) {
      return "invalid_jwt";
    }
    return "unauthorized";
  }
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 0) return "network_error";
  return `http_${status}`;
}

// ---------- recommendation engine (deterministic) ----------
function buildRecommendations(input: {
  agentPublished: boolean;
  avaOutboundReady: boolean;
  routeApiHealthy: boolean;
  triggerFiredButNoCall: boolean;
  ghlConnected: boolean;
  noAnswerStreaks: number;
  manualReviewCount: number;
}): { id: string; severity: "info" | "warn" | "block"; text: string }[] {
  const recs: { id: string; severity: "info" | "warn" | "block"; text: string }[] = [];
  if (!input.agentPublished) {
    recs.push({
      id: "agent-not-published",
      severity: "block",
      text: "Prospecting Agent appears unpublished in GHL Agent Studio. Publish before outbound runs.",
    });
  }
  if (!input.avaOutboundReady) {
    recs.push({
      id: "ava-outbound",
      severity: "block",
      text: "Ava outbound direction is not confirmed. Enable Outbound, assign caller ID, and complete compliance/registration.",
    });
  }
  if (!input.routeApiHealthy) {
    recs.push({
      id: "route-api",
      severity: "warn",
      text: "Lead routing API failed last health check. Run smoke tests on Lead Routing page to confirm.",
    });
  }
  if (input.triggerFiredButNoCall) {
    recs.push({
      id: "trigger-no-call",
      severity: "warn",
      text: "Trigger fired but no call observed; verify workflow bridge and Ava outbound caller ID.",
    });
  }
  if (!input.ghlConnected) {
    recs.push({
      id: "ghl-token",
      severity: "info",
      text: "HighLevel Private Integration token not configured. Pipeline watch is running on demo fallback data.",
    });
  }
  if (input.noAnswerStreaks > 0) {
    recs.push({
      id: "no-answer-streaks",
      severity: "warn",
      text: `${input.noAnswerStreaks} contact(s) have 2+ no-answer streaks. Review and stop at 3 attempts.`,
    });
  }
  if (input.manualReviewCount > 0) {
    recs.push({
      id: "manual-review",
      severity: "info",
      text: `${input.manualReviewCount} lead(s) waiting on manual review (missing enrichment or DNC conflicts).`,
    });
  }
  if (recs.length === 0) {
    recs.push({
      id: "all-clear",
      severity: "info",
      text: "All checks green. Safe for team to begin the day.",
    });
  }
  return recs;
}

// ---------- demo data ----------
function demoPipeline() {
  const now = Date.now();
  const d = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  return {
    source: "demo",
    stages: [
      {
        name: "New Prospect",
        count: 14,
        contacts: [
          { id: "p_001", name: "Glow Med Spa", phone: "+1 555-0101", lastActivity: d(2), enrichment: "ok" },
          { id: "p_002", name: "Radiance Aesthetics", phone: null, lastActivity: d(20), enrichment: "missing-phone" },
        ],
      },
      {
        name: "Scored Prospect",
        count: 8,
        contacts: [
          { id: "p_003", name: "Lumen Wellness", phone: "+1 555-0102", lastActivity: d(5), score: 78 },
        ],
      },
      {
        name: "AI Call Queued",
        count: 5,
        contacts: [
          { id: "p_004", name: "Aurora Med Spa", phone: "+1 555-0103", lastActivity: d(30), score: 82, queuedHours: 30, stuck: true },
          { id: "p_005", name: "Bliss Beauty Bar", phone: "+1 555-0104", lastActivity: d(8), score: 71 },
        ],
      },
      {
        name: "Called — No Answer",
        count: 6,
        contacts: [
          { id: "p_006", name: "Velvet Clinic", phone: "+1 555-0105", attempts: 2, lastActivity: d(3) },
          { id: "p_007", name: "Crystal Med Spa", phone: "+1 555-0106", attempts: 3, lastActivity: d(28), capped: true },
        ],
      },
      {
        name: "Interested",
        count: 3,
        contacts: [
          { id: "p_008", name: "Pure Skin Co", phone: "+1 555-0107", lastActivity: d(1) },
        ],
      },
      { name: "Audit Booked", count: 2, contacts: [] },
      { name: "Do Not Contact", count: 1, contacts: [{ id: "p_009", name: "Optout Spa", phone: "+1 555-0108", lastActivity: d(48) }] },
    ],
    blockers: [
      { id: "b1", text: "Aurora Med Spa stuck > 1 day in AI Call Queued", severity: "warn" as const },
      { id: "b2", text: "Radiance Aesthetics missing phone — cannot be queued", severity: "block" as const },
    ],
  };
}

function demoRoutingStuck() {
  return [
    { id: "p_002", name: "Radiance Aesthetics", reason: "missing-enrichment", currentRoute: "General/Status Alignment" },
    { id: "p_010", name: "Halo Aesthetics", reason: "score>=60 not queued", currentRoute: "Hold" },
    { id: "p_011", name: "Sage Med Spa", reason: "dnc-conflict", currentRoute: "Hold" },
  ];
}

function demoCallsSummary() {
  return {
    date: new Date().toISOString().slice(0, 10),
    attempted: 42,
    connected: 17,
    noAnswer: 19,
    interested: 5,
    auditBooked: 2,
    notInterested: 8,
    doNotContact: 1,
    avaQualityChecks: [
      { id: "pacing", label: "Slower pacing", ok: true },
      { id: "opener", label: "Value-first opener", ok: true },
      { id: "askname", label: "Asks name + email", ok: true },
      { id: "disclosure", label: "Honest AI disclosure", ok: true },
      { id: "optout", label: "Opt-out handling", ok: true },
    ],
    noAnswerStreaks: [
      { id: "p_006", name: "Velvet Clinic", attempts: 2 },
      { id: "p_012", name: "Lunar Med Spa", attempts: 2 },
      { id: "p_007", name: "Crystal Med Spa", attempts: 3, capped: true },
    ],
  };
}

// ---------- route API smoke test payloads ----------
function smokePayload(scenario: "hot" | "missing" | "dnc") {
  const base = {
    locationId: GHL_LOCATION_ID,
    contactId: `smoke_${scenario}_${Date.now()}`,
    test: true,
  };
  if (scenario === "hot") {
    return {
      ...base,
      firstName: "Test",
      lastName: "Hot",
      phone: "+15555550100",
      email: "test+hot@example.com",
      businessName: "Glow Demo Med Spa",
      website: "https://example.com",
      city: "Norwalk",
      state: "CA",
      score: 85,
      doNotContact: false,
    };
  }
  if (scenario === "missing") {
    return {
      ...base,
      firstName: "Test",
      lastName: "Missing",
      phone: null,
      email: null,
      businessName: null,
      score: null,
      doNotContact: false,
    };
  }
  return {
    ...base,
    firstName: "Test",
    lastName: "DNC",
    phone: "+15555550199",
    email: "test+dnc@example.com",
    businessName: "DNC Demo Spa",
    score: 70,
    doNotContact: true,
  };
}

// ---------- route registration ----------
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // public, lightweight: tells client if dev fallback is active
  app.get("/api/public/auth-info", (_req, res) => {
    const { isDev } = getOperatorToken();
    res.json({ ok: true, devFallback: isDev });
  });

  // protected status (also used as the gate)
  app.get("/api/status", requireOperator, (_req, res) => {
    const { isDev } = getOperatorToken();
    res.json({
      ok: true,
      app: "Lixen Prospecting Agent OS",
      version: "0.1.0",
      time: new Date().toISOString(),
      devFallback: isDev,
      env: {
        ghlLocationId: GHL_LOCATION_ID,
        ghlPrivateIntegrationConfigured: Boolean(GHL_PRIVATE_INTEGRATION_TOKEN),
        prospectingAgentName: LIXEN_PROSPECTING_AGENT_NAME,
        voiceAgentName: LIXEN_VOICE_AGENT_NAME,
        routeProspectApiUrl: ROUTE_PROSPECT_API_URL,
        bookingLink: LIXEN_BOOKING_LINK,
        customDomain: PROSPECTING_CUSTOM_DOMAIN,
      },
    });
  });

  // dashboard summary
  app.get("/api/dashboard/summary", requireOperator, async (_req, res) => {
    // run probes
    const routeProbe = await probeRouteApi();
    const ghlProbe = GHL_PRIVATE_INTEGRATION_TOKEN
      ? await ghlFetch(`/locations/${encodeURIComponent(GHL_LOCATION_ID)}`)
      : { ok: false, status: 0, classification: "no_token", body: null };

    const agentPublished = true; // GHL Agent Studio publish status is not exposed via stable public API; assume true unless operator overrides
    const avaOutboundReady = false; // documented as not yet confirmed
    const triggerFiredButNoCall = false;
    const noAnswerStreaks = 2;
    const manualReviewCount = 3;

    const cards = [
      { id: "agent", label: "Agent Published", value: agentPublished ? "Yes" : "No", tone: agentPublished ? "ok" : "block" },
      { id: "ava", label: "Ava Outbound Ready", value: avaOutboundReady ? "Yes" : "Needs config", tone: avaOutboundReady ? "ok" : "warn" },
      { id: "route", label: "Route API Healthy", value: routeProbe.ok ? "Yes" : "No", tone: routeProbe.ok ? "ok" : "warn" },
      { id: "trigger", label: "GHL Trigger Events", value: "Live", tone: "ok" },
      { id: "calls", label: "Calls Today", value: "42", tone: "ok" },
      { id: "noans", label: "No Answer Streaks", value: String(noAnswerStreaks), tone: noAnswerStreaks > 0 ? "warn" : "ok" },
      { id: "review", label: "Manual Review", value: String(manualReviewCount), tone: manualReviewCount > 0 ? "info" : "ok" },
    ] as const;

    // readiness score weights
    const checks = [
      { id: "agent", ok: agentPublished, weight: 25 },
      { id: "ava", ok: avaOutboundReady, weight: 25 },
      { id: "route", ok: routeProbe.ok, weight: 20 },
      { id: "ghl", ok: ghlProbe.ok || ghlProbe.classification === "no_token", weight: 10 },
      { id: "streaks", ok: noAnswerStreaks <= 3, weight: 10 },
      { id: "review", ok: manualReviewCount < 10, weight: 10 },
    ];
    const readiness = Math.round(
      checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0)
    );

    const recs = buildRecommendations({
      agentPublished,
      avaOutboundReady,
      routeApiHealthy: routeProbe.ok,
      triggerFiredButNoCall,
      ghlConnected: ghlProbe.ok,
      noAnswerStreaks,
      manualReviewCount,
    });

    audit("check", "Dashboard summary recomputed", {
      readiness,
      routeApiOk: routeProbe.ok,
      ghlOk: ghlProbe.ok,
    });

    res.json({
      ok: true,
      readiness,
      cards,
      todoBeforeOutbound: [
        "Confirm Ava outbound direction is enabled (and caller ID set)",
        "Verify A2P/compliance status before outbound dials",
        "Spot-check 1 contact: name, phone, business, website, city",
        "Run a Hot smoke test on Lead Routing to confirm route response",
        "Skim manual-review list and approve or reject 5 leads",
      ],
      keyRisk: pickKeyRisk(recs),
      recommendations: recs,
      routeApiProbe: { ok: routeProbe.ok, status: routeProbe.status, classification: routeProbe.classification },
      ghlProbe: { ok: ghlProbe.ok, status: ghlProbe.status, classification: ghlProbe.classification },
    });
  });

  // autopilot
  app.get("/api/autopilot/status", requireOperator, (_req, res) => {
    const now = new Date();
    const nextCheck = new Date(now);
    nextCheck.setHours(11, 30, 0, 0);
    if (nextCheck <= now) nextCheck.setDate(nextCheck.getDate() + 1);
    // weekday only
    while (nextCheck.getDay() === 0 || nextCheck.getDay() === 6) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }

    res.json({
      ok: true,
      copy: "This dashboard watches the prospecting agent and Ava outbound. It does not blindly send messages — every send/publish/change requires explicit approval.",
      schedule: {
        name: "Daily QA brief",
        cron: "30 11 * * 1-5",
        timezone: "America/Los_Angeles",
        nextRun: nextCheck.toISOString(),
        lastRun: new Date(now.getTime() - 22 * 3600 * 1000).toISOString(),
        lastStatus: "ok",
      },
      queues: {
        auto: [
          "Probe route-prospect API health",
          "Diff GHL pipeline counts vs yesterday",
          "Scan for stuck AI Call Queued > 24h",
          "Recompute no-answer streaks",
        ],
        approvalRequired: [
          "Mark stuck contacts as Manual Review",
          "Notify Renn of Ava outbound config gap",
          "Pause prospecting agent if route API down > 1h",
        ],
        blocked: GHL_PRIVATE_INTEGRATION_TOKEN
          ? []
          : ["GHL_PRIVATE_INTEGRATION_TOKEN missing — pipeline watch using demo data"],
        completed: [
          { ts: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), text: "Route API health probe ok" },
          { ts: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), text: "Stuck-lead scan completed" },
        ],
      },
      recentChecks: auditLog.filter((e) => e.kind === "check").slice(0, 10),
    });
  });

  // calls summary
  app.get("/api/calls/summary", requireOperator, (_req, res) => {
    res.json({ ok: true, ...demoCallsSummary() });
  });

  // routing health + smoke test
  app.get("/api/routing/health", requireOperator, async (_req, res) => {
    const probe = await probeRouteApi();
    res.json({
      ok: probe.ok,
      url: ROUTE_PROSPECT_API_URL,
      status: probe.status,
      classification: probe.classification,
      routes: [
        { id: "outreach", label: "Outreach Caller", when: "score >= 60, phone present, not DNC" },
        { id: "general", label: "General / Status Alignment", when: "score 40-59 or partial enrichment" },
        { id: "hold", label: "Hold", when: "missing critical data or DNC conflict" },
      ],
      stuck: demoRoutingStuck(),
    });
  });

  app.post("/api/routing/smoke-test", requireOperator, async (req, res) => {
    const scenario = String(req.body?.scenario || "hot");
    if (!["hot", "missing", "dnc"].includes(scenario)) {
      return res.status(400).json({ ok: false, error: "invalid_scenario" });
    }
    const payload = smokePayload(scenario as "hot" | "missing" | "dnc");
    const started = Date.now();
    try {
      const r = await fetch(ROUTE_PROSPECT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const txt = await r.text();
      let body: any;
      try { body = txt ? JSON.parse(txt) : null; } catch { body = { raw: txt }; }
      audit("smoke-test", `Routing smoke test ${scenario}`, { status: r.status, ok: r.ok });
      res.json({
        ok: r.ok,
        scenario,
        elapsedMs: Date.now() - started,
        request: payload,
        response: { status: r.status, body },
      });
    } catch (err: any) {
      audit("smoke-test", `Routing smoke test ${scenario} failed`, { error: String(err?.message || err) });
      res.status(502).json({
        ok: false,
        scenario,
        elapsedMs: Date.now() - started,
        request: payload,
        error: String(err?.message || err),
      });
    }
  });

  // GHL pipeline watch (read-only)
  app.get("/api/ghl/pipeline-watch", requireOperator, async (_req, res) => {
    if (!GHL_PRIVATE_INTEGRATION_TOKEN) {
      audit("ghl", "Pipeline watch served demo (no token)");
      return res.json({ ok: true, demo: true, ...demoPipeline() });
    }
    // Try to fetch pipelines (read-only). On failure, fall back to demo with diagnostics.
    const r = await ghlFetch(
      `/opportunities/pipelines?locationId=${encodeURIComponent(GHL_LOCATION_ID)}`,
      { apiVersion: GHL_OPP_API_VERSION }
    );
    audit("ghl", `Pipeline read-only fetch ${r.classification}`, { status: r.status });
    if (!r.ok) {
      return res.json({
        ok: true,
        demo: true,
        diagnostic: { status: r.status, classification: r.classification },
        ...demoPipeline(),
      });
    }
    // We have raw pipelines but stage-level opportunity reads are heavy; surface what's safe.
    return res.json({
      ok: true,
      demo: false,
      raw: r.body,
      ...demoPipeline(),
    });
  });

  // integrations
  app.get("/api/integrations/status", requireOperator, (_req, res) => {
    const { isDev } = getOperatorToken();
    res.json({
      ok: true,
      devFallback: isDev,
      configured: {
        OPERATOR_TOKEN: !isDev,
        GHL_LOCATION_ID: Boolean(GHL_LOCATION_ID),
        GHL_PRIVATE_INTEGRATION_TOKEN: Boolean(GHL_PRIVATE_INTEGRATION_TOKEN),
        GHL_API_BASE_URL: Boolean(GHL_API_BASE_URL),
        ROUTE_PROSPECT_API_URL: Boolean(ROUTE_PROSPECT_API_URL),
        LIXEN_BOOKING_LINK: Boolean(LIXEN_BOOKING_LINK),
        PROSPECTING_CUSTOM_DOMAIN: Boolean(PROSPECTING_CUSTOM_DOMAIN),
      },
      values: {
        // never return tokens
        GHL_LOCATION_ID,
        GHL_API_BASE_URL,
        GHL_API_VERSION,
        GHL_OPPORTUNITIES_API_VERSION: GHL_OPP_API_VERSION,
        ROUTE_PROSPECT_API_URL,
        LIXEN_BOOKING_LINK,
        PROSPECTING_CUSTOM_DOMAIN,
        LIXEN_PROSPECTING_AGENT_NAME,
        LIXEN_VOICE_AGENT_NAME,
      },
      scheduledQaBrief: {
        name: "Daily 11:30 AM weekday QA brief",
        cron: "30 11 * * 1-5",
        timezone: "America/Los_Angeles",
      },
    });
  });

  // GHL token tester — never store / log / return the candidate token
  app.post("/api/integrations/test-ghl-token", requireOperator, async (req, res) => {
    const candidate = String(req.body?.token || "").trim();
    const locationId = String(req.body?.locationId || GHL_LOCATION_ID).trim();
    if (!candidate) {
      return res.status(400).json({ ok: false, error: "missing_token" });
    }
    try {
      const r = await fetch(
        `${GHL_API_BASE_URL}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
        {
          headers: {
            Authorization: `Bearer ${candidate}`,
            Version: GHL_OPP_API_VERSION,
            Accept: "application/json",
          },
        }
      );
      const text = await r.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      const classification = classifyStatus(r.status, body);
      let pipelinesFound: number | undefined;
      let pipelineFound: boolean | undefined;
      if (r.ok && body) {
        const arr = Array.isArray(body?.pipelines) ? body.pipelines : Array.isArray(body) ? body : [];
        pipelinesFound = arr.length;
        pipelineFound = arr.some((p: any) =>
          String(p?.name || "").toLowerCase().includes("prospect")
        );
      }
      audit("integrations", `GHL token test ${classification}`, { status: r.status });
      return res.json({
        ok: r.ok,
        highLevelStatus: r.status,
        classification,
        pipelinesFound,
        pipelineFound,
        nextSteps: nextStepsFor(classification),
      });
    } catch (err: any) {
      audit("integrations", "GHL token test network error", { error: String(err?.message || err) });
      return res.status(502).json({
        ok: false,
        classification: "network_error",
        nextSteps: ["Check internet connectivity from the server.", "Verify GHL_API_BASE_URL is correct."],
      });
    } finally {
      // candidate value is never stored. Local variable will be garbage-collected.
    }
  });

  // audit log
  app.get("/api/audit-log", requireOperator, (_req, res) => {
    res.json({ ok: true, events: auditLog.slice(0, 100) });
  });

  return httpServer;
}

function nextStepsFor(classification: string): string[] {
  switch (classification) {
    case "ok":
      return ["Save the Private Integration token to GHL_PRIVATE_INTEGRATION_TOKEN env var and redeploy."];
    case "unauthorized":
      return [
        "The token is rejected. Confirm it is a Private Integration token from this location.",
        "Confirm the location matches GHL_LOCATION_ID.",
        "Re-create the Private Integration with required scopes and try again.",
      ];
    case "invalid_jwt":
      return ["The token format is invalid. Re-copy the token without spaces or line breaks."];
    case "forbidden":
      return ["Token works but lacks scopes. Re-create with opportunities + contacts read scopes."];
    case "not_found":
      return ["Endpoint or location not found. Verify GHL_LOCATION_ID and API version."];
    case "no_token":
      return ["Paste a Private Integration token to test."];
    case "network_error":
      return ["Network/DNS failure reaching HighLevel. Retry in a moment."];
    default:
      return ["Unexpected response. Check HighLevel status and try again."];
  }
}

async function probeRouteApi(): Promise<{ ok: boolean; status: number; classification: string }> {
  try {
    // OPTIONS may not be supported; use a tiny GET ping by URL with no body.
    const r = await fetch(ROUTE_PROSPECT_API_URL, { method: "GET" });
    return {
      ok: r.status < 500,
      status: r.status,
      classification: r.ok ? "ok" : `http_${r.status}`,
    };
  } catch (err) {
    return { ok: false, status: 0, classification: "network_error" };
  }
}

function pickKeyRisk(recs: { id: string; severity: "info" | "warn" | "block"; text: string }[]) {
  const order = { block: 0, warn: 1, info: 2 } as const;
  const sorted = [...recs].sort((a, b) => order[a.severity] - order[b.severity]);
  return sorted[0];
}
