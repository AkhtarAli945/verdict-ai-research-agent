# Verdict

**AI business research agent: ask a decision, get a cited report.**

Ask *"Should we launch an AI SaaS for restaurants in Pakistan?"*. A LangGraph supervisor runs six agents
(research, market, competitor, customer, financial, report) and returns a verdict, SWOT, pricing comparison,
PKR revenue forecast, and numbered citations to web pages or your own documents.

<!-- ![Report](docs/screenshots/report.png) -->

## Features
- Multi-agent pipeline with a plan step you can edit before research starts
- Cited answers, with KPIs labelled `sourced`, `assumed` or `estimate`
- Upload PDF, CSV, TXT or MD and search them with local embeddings (RAG)
- Live progress over Server-Sent Events
- Register, sign in, sign out (registering does not log you in)
- Responsive on phone, iPad, laptop and big screens, with dark mode and PDF export

## Stack
React 19 + Vite · Node + Express 5 · MongoDB Atlas · LangGraph · Groq (`openai/gpt-oss-120b`) · Tavily search ·
`all-MiniLM-L6-v2` embeddings (local) · JWT in an httpOnly cookie

## Quick start
Needs Node 20+, a MongoDB URI ([Atlas M0](https://www.mongodb.com/cloud/atlas) is free), a [Groq key](https://console.groq.com/keys),
and optionally a [Tavily key](https://app.tavily.com).

```bash
npm run setup
cp server/.env.example server/.env   # Windows: copy server\.env.example server\.env
npm run dev:server                   # terminal 1, API on :5000
npm run dev:client                   # terminal 2, app on :5173
```
Open http://localhost:5173, register, then sign in.

## Configuration (`server/.env`)
| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | Yes | Include the database name, e.g. `/verdict` |
| `JWT_SECRET` | Yes | Long random string |
| `GROQ_API_KEY` | Yes | Free at console.groq.com |
| `GROQ_MODEL` | No | Default `openai/gpt-oss-120b` |
| `GROQ_TPM` | No | Pacing limit, default `8000` |
| `TAVILY_API_KEY` | No | Without it, no live web search |

## Troubleshooting
| Symptom | Fix |
|---|---|
| `querySrv ESERVFAIL` / `EAI_AGAIN` | DNS cannot resolve Atlas. Use Atlas's long `mongodb://` string or set `DNS_SERVERS=8.8.8.8,1.1.1.1` |
| `Could not connect to any servers` | Add your IP (or `0.0.0.0/0` for testing) in Atlas Network Access |
| `model ... decommissioned` | Set a current `GROQ_MODEL` from console.groq.com/docs/models |
| `rate limit reached` | Free tier limit. Wait a minute and retry |
| `[embeddings] ... terminated` | Model download cut off. Restart, or set `HF_REMOTE_HOST=https://hf-mirror.com/` |

## Notes
- Free tier is slow by design: a full analysis takes about 3 to 6 minutes.
- Quick / Standard / Deep is saved but does not change the work yet.
- Planned: email verification, tests, Urdu interface, Atlas Vector Search.

## Deploy
`npm run build`, then `npm --prefix server start` with `NODE_ENV=production` (Express serves the built app). Use HTTPS.

## Author
**Akhtar Ali** · [GitHub](https://github.com/AkhtarAli945) · [LinkedIn](https://www.linkedin.com/in/akhtarali-mern)
