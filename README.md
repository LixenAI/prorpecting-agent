# Lixen Prospecting Agent OS

Internal command center for the LixenAI Prospecting Agent and Ava outbound workflow.
Built as a full-stack Express + Vite + React + TypeScript app with an operator-token
auth gate. The dashboard observes and recommends; it does not send calls/SMS/emails
or change GHL without explicit approval.

## Stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS v3, shadcn/ui, wouter hash routing, TanStack Query
- **Backend**: Express 5 on Node 20, no DB writes required (in-memory audit log + demo fallback)
- **Auth**: operator token via `Authorization: Bearer …`. Token is held in React state only — never in localStorage/sessionStorage/cookies.

## Quick start

```bash
npm install
npm run check     # TypeScript
npm run build     # production build (client + server)
npm run dev       # dev server on PORT=5000

# production
PORT=5000 NODE_ENV=production node dist/index.cjs
```

If `OPERATOR_TOKEN` env var is not set, a development fallback token
`lixen-prospecting-dev` is accepted and the dashboard surfaces a yellow warning banner.

## Environment variables

```bash
OPERATOR_TOKEN=<set a long random operator token>
GHL_LOCATION_ID=C7e7ReTQ4FXMZp9TjxzU
GHL_PRIVATE_INTEGRATION_TOKEN=<HighLevel Private Integration token, read scopes only>
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28
GHL_OPPORTUNITIES_API_VERSION=2023-02-21
LIXEN_PROSPECTING_AGENT_NAME=LixenAI Prospecting Agent
LIXEN_VOICE_AGENT_NAME=Ava — Med Spa Prospecting Agent
ROUTE_PROSPECT_API_URL=https://prorpecting-agent.vercel.app/api/route-prospect
LIXEN_BOOKING_LINK=https://link.lixen.ai/widget/booking/W0BVrWmszScBAjQhN631
PROSPECTING_CUSTOM_DOMAIN=prospecting-agent.lixenai.com
```

## API surface

All endpoints prefixed `/api`. All except `GET /api/public/auth-info` require
`Authorization: Bearer <OPERATOR_TOKEN>`.

| Method | Path                              | Purpose                                                 |
|-------:|-----------------------------------|---------------------------------------------------------|
|    GET | `/api/public/auth-info`           | Public: tells client whether dev fallback is active.    |
|    GET | `/api/status`                     | Auth probe + env summary (no secrets).                  |
|    GET | `/api/dashboard/summary`          | Readiness score, status cards, recommendations.         |
|    GET | `/api/autopilot/status`           | QA brief schedule, queues, recent checks.               |
|    GET | `/api/calls/summary`              | Daily call outreach metrics + Ava quality checks.       |
|    GET | `/api/routing/health`             | Probes route-prospect API + lists stuck routes.         |
|   POST | `/api/routing/smoke-test`         | Body `{ scenario: "hot" \| "missing" \| "dnc" }`.       |
|    GET | `/api/ghl/pipeline-watch`         | Read-only GHL pipeline; demo data when no token.        |
|    GET | `/api/integrations/status`        | Per-env-var booleans + non-secret values.               |
|   POST | `/api/integrations/test-ghl-token`| Read-only HighLevel token validation. Never stored.     |
|    GET | `/api/audit-log`                  | Read-only event log of dashboard activity.              |

## Pages (hash routes)

`#/` Dashboard · `#/autopilot` · `#/calls` · `#/routing` · `#/ghl` · `#/ava` ·
`#/integrations` · `#/audit` · `#/sop`

## Safety boundaries

- HighLevel calls are read-only. The candidate Private Integration token submitted to
  the token-tester is used in memory and **never stored, logged, or returned**.
- Route smoke tests run server-side and never write to GHL.
- No SMS, email, voice, ad spend, or workflow publish actions exist anywhere in the app.
- Dashboard explicitly warns: dev fallback token in use, until `OPERATOR_TOKEN` is set.

## Deploy

After build, the production server serves both the static client (from `dist/public`)
and the API on `PORT=5000`. Point `prospecting-agent.lixenai.com` at the host.

Local QA screenshots are in `/home/user/workspace/qa-*.png`.
