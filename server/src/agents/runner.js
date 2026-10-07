import { Analysis, STEPS } from '../models/index.js';
import { bus } from './bus.js';
import { pipeline, planTopic } from './graph.js';
import { tavilySearch } from './tools.js';
import { retrieve } from './rag.js';

const push = (id, payload) => bus.emit(id, payload);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Short internet or DNS blips should not kill a running analysis.
const safe = (fn) => fn().catch((e) => console.warn('[db]', e.message));
async function retry(fn, tries = 6) { for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= tries) throw e; console.warn(`[db] retry ${i}/${tries - 1}: ${e.message}`); await sleep(3000 * i); } } }
export const snapshot = async (id) => push(id, { type: 'snapshot', analysis: await Analysis.findById(id).lean() });

async function log(id, agent, msg) {
  await safe(() => Analysis.updateOne({ _id: id }, { $push: { events: { agent, msg } } }));
  push(id, { type: 'log', agent, msg, at: new Date() });
}
async function setStep(id, name, status) {
  await safe(() => Analysis.updateOne({ _id: id, 'steps.name': name }, { $set: { 'steps.$.status': status } }));
  await safe(() => snapshot(id));
}
async function fail(id, err) {
  console.error('[analysis]', id.toString(), err.message || err);
  const msg = /timed out|timeout|ECONN|EAI_AGAIN|fetch failed|connection/i.test(String(err.message) + String(err.name))
    ? 'Your internet connection to the AI service dropped or timed out. Check your connection and start again.'
    : err.message || 'Something went wrong.';
  await retry(() => Analysis.updateOne({ _id: id }, { status: 'failed', error: msg })).catch((e) => console.error('[db] could not save failure:', e.message));
  await safe(() => snapshot(id));
}

export async function startPlan(a) {
  try {
    await setStep(a._id, 'plan', 'running');
    await log(a._id, 'plan', 'Drafting a research plan');
    const p = await planTopic(a.question, a.region);
    await retry(() => Analysis.updateOne({ _id: a._id }, { status: 'awaiting_approval', plan: { topic: p.topic, competitors: p.competitors?.slice(0, 8), focus: p.focus } }));
    await setStep(a._id, 'plan', 'done');
  } catch (e) { await fail(a._id, e); }
}

export async function startPipeline(id) {
  const a = await Analysis.findById(id);
  const sources = [];
  const add = (s) => { const i = sources.findIndex((x) => x.title === s.title && x.url === s.url); if (i >= 0) return i + 1; sources.push(s); return sources.length; };
  const ctx = {
    question: a.question, region: a.region || 'Pakistan', topic: a.plan.topic || a.question, competitors: a.plan.competitors || [], sources,
    emit: (agent, msg) => log(id, agent, msg),
    step: (n, s) => setStep(id, n, s),
    async search(q, max = 4) {
      await log(id, 'search', `Searching: ${q}`);
      const rows = await tavilySearch(q, max);
      if (!rows) { await log(id, 'search', 'Web search is off (no TAVILY_API_KEY). Using documents and model knowledge only.'); return ''; }
      return rows.map((r) => `[${add({ title: r.title, url: r.url, type: 'web' })}] ${r.title}: ${r.content.slice(0, 500)}`).join('\n');
    },
    async docs(q) {
      if (!a.useDocs) return '';
      const hits = await retrieve(a.user, q, 4);
      if (hits.length) await log(id, 'documents', `Found ${hits.length} passages in your documents`);
      return hits.map((h) => `[${add({ title: h.docName + (h.page ? ` p.${h.page}` : ''), type: 'upload' })}] ${h.text.slice(0, 500)}`).join('\n');
    },
  };
  try {
    await retry(() => Analysis.updateOne({ _id: id }, { status: 'running' }));
    await safe(() => snapshot(id));
    const out = await pipeline.invoke({}, { configurable: { ctx }, recursionLimit: 40 });
    await retry(() => Analysis.updateOne({ _id: id }, { status: 'done', report: out.data.report }));
    await log(id, 'report', 'Report ready');
    await safe(() => snapshot(id));
  } catch (e) { await fail(id, e); }
}

export const newSteps = () => STEPS.map((name) => ({ name, status: 'queued' }));
