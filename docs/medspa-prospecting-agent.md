# Lixen AI Med Spa Prospecting Agent

## Setup Overview

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Keep `MOCK_AI_CALLER=true` and `MOCK_GHL=true` until live provider credentials are verified.
4. Run `npm run dev`.
5. Open `http://localhost:5173/medspa-prospecting`.

The MVP stores local data in `data/leads.json` and `data/settings.json`.

## Environment Variables

Core:

- `MOCK_AI_CALLER=true`
- `MOCK_GHL=true`
- `PUBLIC_APP_URL=http://localhost:8787`
- `QUALIFICATION_SCORE_THRESHOLD=60`

GoHighLevel:

- `GHL_LOCATION_ID`
- `GHL_ACCESS_TOKEN`
- `GHL_PIPELINE_ID`
- `GHL_STAGE_NEW_PROSPECT`
- `GHL_STAGE_AI_CALL_QUEUED`
- `GHL_STAGE_CALLED_NO_ANSWER`
- `GHL_STAGE_INTERESTED`
- `GHL_STAGE_AUDIT_BOOKED`
- `GHL_STAGE_NO_SHOW`
- `GHL_STAGE_PROPOSAL_SENT`
- `GHL_STAGE_CLOSED_WON`
- `GHL_STAGE_CLOSED_LOST`
- `GHL_STAGE_DO_NOT_CONTACT`
- `GHL_CALENDAR_ID`

AI caller:

- `AI_CALL_PROVIDER=manual_webhook`
- `AI_CALL_API_KEY`
- `AI_CALL_WEBHOOK_URL`
- `AI_CALL_AGENT_ID`
- `AI_CALL_FROM_NUMBER`
- `AI_CALL_MAX_DAILY_CALLS=50`
- `AI_CALL_RATE_LIMIT_PER_HOUR=10`

Compliance:

- `CALLING_TIMEZONE=America/Los_Angeles`
- `CALLING_START_HOUR=9`
- `CALLING_END_HOUR=17`
- `MAX_CALL_ATTEMPTS=3`
- `MAX_DAILY_CALLS=50`

Notifications and automation:

- `TEAM_NOTIFICATION_WEBHOOK_URL`
- `ROB_EMAIL`
- `IREINE_EMAIL`
- `MAKE_ZAPIER_WEBHOOK_URL`
- `BOOKING_CALENDAR_URL`

Google Sheets placeholder:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

## GHL Pipeline Setup

Create a pipeline with these stages:

1. New Prospect
2. AI Call Queued
3. Called - No Answer
4. Interested
5. Audit Booked
6. No Show
7. Proposal Sent
8. Closed Won
9. Closed Lost
10. Do Not Contact

Add the stage IDs to `.env`. The dashboard settings page can store non-secret mappings, but secrets must stay in environment variables.

## GHL Tags

Recommended workflow tags:

- `medspa_prospect`
- `medspa_priority_a`
- `medspa_ai_call_queued`
- `medspa_called_no_answer`
- `medspa_interested`
- `medspa_audit_booked`
- `medspa_follow_up_needed`
- `do_not_contact`

GHL workflows can use these tags to send SMS, email, booking links, reminders, and internal notifications.

## AI Caller Setup

Supported adapter names:

- `vapi`
- `retell`
- `bland`
- `synthflow`
- `woosender`
- `manual_webhook`

The current live adapter sends a normalized payload to `AI_CALL_WEBHOOK_URL`. Provider-specific SDK calls can be added inside `server/services/aiCaller.ts` without changing the rest of the app.

The default script is in `src/lib/callScript.ts`. Ava must identify as calling from Lixen AI and truthfully say she is an AI assistant if asked.

## Import Format

Use `sample-medspa-leads.csv` as the template. Supported columns:

- Business Name
- City
- State
- Phone
- Email
- Website
- Instagram
- Facebook
- Google Rating
- Review Count
- Services
- Owner/Manager Name
- Visible Weaknesses
- Source

Every callable lead must have a business name, phone, and source.

## API Endpoints

- `GET /api/leads`
- `POST /api/leads`
- `POST /api/import/csv`
- `POST /api/import/google-sheet`
- `POST /api/leads/:id/score`
- `POST /api/leads/score-all`
- `POST /api/leads/:id/queue-ai-call`
- `POST /api/leads/queue-batch`
- `POST /api/leads/:id/sync-ghl`
- `POST /api/route-prospect`
- `POST /api/ai-call/outcome`
- `POST /api/leads/:id/do-not-contact`
- `PATCH /api/leads/:id/status`
- `GET /api/export/leads`
- `GET/PATCH /api/settings`

## GHL / Lixen Agent Studio Routing

The Agent Studio workflow must NEVER pause to ask a human for missing
prospect info during execution. Use `POST /api/route-prospect` from the
Enrichment & Scoring node to get a deterministic routing decision.

Request body (any field may be omitted — the endpoint never throws on
missing data):

```json
{
  "businessName": "{{contact.company_name}}",
  "city": "{{contact.city}}",
  "website": "{{contact.website}}",
  "phone": "{{contact.phone}}",
  "leadScore": "{{contact.custom_fields.medspa_score}}",
  "qualificationStatus": "{{contact.custom_fields.qualification_status}}",
  "visibleWeaknesses": "{{contact.custom_fields.visible_weaknesses}}",
  "services": "{{contact.custom_fields.services}}",
  "googleRating": "{{contact.custom_fields.google_rating}}",
  "reviewCount": "{{contact.custom_fields.review_count}}",
  "optOut": "{{contact.dnd}}"
}
```

Response:

```json
{
  "route": "Outreach Caller" | "General/Status Alignment" | "Hold",
  "qualificationStatus": "Hot" | "Warm" | "Cold" | "Unqualified" | "Needs enrichment data",
  "leadScore": 82,
  "needsEnrichment": false,
  "missingFields": [],
  "reasons": ["Lead qualified (score=82, status=Hot); routing to Outreach Caller."],
  "tags": ["medspa_ai_call_queued"]
}
```

Routing rules (mirrored exactly in `src/lib/routing.ts`):

1. **`optOut` or `status=do_not_contact`** → `route=Hold`, tag `do_not_contact`. Never call.
2. **`leadScore >= 60` OR `qualificationStatus in {Hot, Warm}`** AND no missing fields → `route=Outreach Caller`, tag `medspa_ai_call_queued`.
3. **Missing `businessName` / `city` / `website` OR no `leadScore` available** → `route=General/Status Alignment`, tag `needs_enrichment_data`. The workflow continues — it does not stop to ask a human.
4. **`leadScore < 60` and no qualifying status** → `route=Hold`. Do not call.

In the GHL Agent Studio config:

- The `medspa_prospect_ready` tag fires the Enrichment & Scoring node.
- The Enrichment & Scoring node calls `POST /api/route-prospect` (or runs the equivalent rules inline) and writes `lead_score`, `qualification_status`, and any `needs_enrichment_data` tag back onto the contact.
- The router node branches on `route`:
  - `Outreach Caller` → invoke the AI caller agent.
  - `General/Status Alignment` → status update / enrichment task workflow.
  - `Hold` → no action.
- The Outreach Caller agent must include the booking link `https://link.lixen.ai/widget/booking/W0BVrWmszScBAjQhN631` in interested-path messages.

### Fallback workflow without Agent Studio

If Agent Studio cannot be configured correctly, the same logic runs end-to-end via this app:

1. `POST /api/leads` (or `/api/import/csv`) ingests prospects.
2. `POST /api/leads/score-all` runs the scoring engine (qualificationStatus + tier).
3. `POST /api/leads/queue-batch` queues every lead with `score >= QUALIFICATION_SCORE_THRESHOLD` (default 60) through the AI caller adapter.
4. `POST /api/ai-call/outcome` ingests call outcomes and `POST /api/leads/:id/sync-ghl` syncs back to GHL.

With `MOCK_AI_CALLER=true` and `MOCK_GHL=true` (defaults), this whole pipeline runs without any live external calls.

## Testing Checklist

1. Import `sample-medspa-leads.csv`.
2. Score all leads.
3. Confirm Priority A/B/C/Low tiers show in the dashboard.
4. Queue a Priority A lead during allowed business hours.
5. Confirm opt-out and Do Not Contact leads cannot be queued.
6. Simulate no-answer, interested, audit-booked, and opt-out outcomes from a lead detail page.
7. Confirm GHL mock payloads are logged when `MOCK_GHL=true`.
8. Confirm AI caller mock payloads are logged when `MOCK_AI_CALLER=true`.
9. Run `npm test`.
10. Run `npm run build`.

## Compliance Notes

This system is for B2B outreach only using public business contact information. It must not mass-call consumers or private individuals.

Guardrails implemented in code:

- Blocks opt-out leads.
- Blocks `do_not_contact` status.
- Requires business name, phone, and source.
- Enforces score threshold.
- Enforces allowed business hours.
- Enforces daily and hourly call limits.
- Tracks call attempts.
- Stops after max attempts.
- Stores opt-out requests.
- Provides manual Do Not Contact action.
- Logs every AI call queue and outcome.

## Deployment

For a production deployment:

1. Use a persistent database instead of local JSON files.
2. Set live environment variables in the host.
3. Set `MOCK_AI_CALLER=false` only after provider webhook tests pass.
4. Set `MOCK_GHL=false` only after GHL contact and opportunity tests pass.
5. Configure `PUBLIC_APP_URL` to the deployed API URL.
6. Point the AI caller outcome webhook to `/api/ai-call/outcome`.
7. Configure GHL and Make/Zapier workflows to suppress `do_not_contact`.

### Vercel deployment (frontend + `/api/route-prospect` for GHL Agent Studio)

The repo ships with `vercel.json` and a Vercel serverless function at
`api/route-prospect.ts` that imports the shared `routeProspect` logic from
`src/lib/routing.ts`. The public Vercel URL exposes the same non-blocking
routing contract as the local Express server without duplicating logic.

What Vercel runs:

- `npm run build` produces the static frontend in `dist/`.
- Files under `api/` are auto-detected as Node serverless functions.
- All non-`/api` routes fall back to `index.html` (SPA routing).

To deploy after merging to `main`:

```bash
npx vercel --token $VERCEL_TOKEN --prod --yes
```

The first run will prompt you to link the local checkout to a Vercel project;
subsequent runs are non-interactive. Drop `--prod` for a preview deploy.

The exact public URL pattern that GHL / Lixen Agent Studio must call:

```
POST https://<your-vercel-project>.vercel.app/api/route-prospect
Content-Type: application/json
```

Body and response shape are identical to the local Express endpoint
documented above. The handler is mock-safe — it never calls GHL or the AI
caller; it only returns a routing decision. To exercise it locally against the
serverless code path, use `vercel dev`:

```bash
npx vercel dev
curl -s -X POST http://localhost:3000/api/route-prospect \
  -H 'content-type: application/json' \
  -d '{"businessName":"Glow Med Spa","city":"Irvine","website":"https://glow.example","leadScore":82}'
```

Unit coverage for both the shared routing module and the serverless handler
lives in `tests/routing.test.ts` and `tests/api-route-prospect.test.ts`.

## Known MVP Limits

- Google Sheets endpoint is a credential-safe placeholder; CSV import is complete.
- Provider-specific Vapi/Retell/Bland/Synthflow/WooSender SDK payloads are abstracted behind a normalized webhook adapter.
- Local JSON storage is suitable for MVP testing only.
