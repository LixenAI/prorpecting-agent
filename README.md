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

## Docs

See [docs/medspa-prospecting-agent.md](docs/medspa-prospecting-agent.md) for setup, environment variables, GHL stages/tags, import format, testing checklist, and deployment notes.
