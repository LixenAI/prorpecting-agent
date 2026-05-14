# Lixen AI Med Spa Prospecting Agent

MVP web app for B2B med spa prospecting: import leads, score automation pain signals, queue qualified prospects for an AI caller, sync to GoHighLevel, receive call outcomes, and trigger follow-up workflows.

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173/medspa-prospecting`.

The API runs on `http://localhost:8787` and Vite proxies `/api` requests to it.

## MVP Workflow

CSV or manual lead entry -> local lead database -> scoring engine -> qualified call queue -> AI caller adapter -> GHL contact/opportunity sync -> call outcome webhook -> follow-up trigger -> reporting dashboard.

## Safety Defaults

`MOCK_AI_CALLER=true` and `MOCK_GHL=true` are enabled by default. In mock mode, the app logs provider payloads and creates mock IDs instead of calling live vendors.

The queue blocks leads that are opted out, marked Do Not Contact, missing business name/phone/source, below the score threshold, past max attempts, outside allowed calling hours, or over call volume limits.

## GHL / Lixen Agent Studio Routing

The Enrichment & Scoring node in the Agent Studio workflow must never pause for human input on missing prospect fields. Call `POST /api/route-prospect` with whatever contact data is available — the endpoint never throws and returns a routing decision:

- `route=Outreach Caller` when `leadScore >= 60` or `qualificationStatus` is Hot/Warm.
- `route=General/Status Alignment` (tag `needs_enrichment_data`) when business name, city, or website is missing, or when no `lead_score` is available.
- `route=Hold` for opt-out / Do Not Contact and below-threshold leads.

See [docs/medspa-prospecting-agent.md](docs/medspa-prospecting-agent.md) for the full payload contract and Agent Studio configuration steps.

## Docs

See [docs/medspa-prospecting-agent.md](docs/medspa-prospecting-agent.md) for setup, environment variables, GHL stages/tags, import format, testing checklist, and deployment notes.
