import { Router } from 'express';
import { Analysis } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { bus } from '../agents/bus.js';
import { startPlan, startPipeline, newSteps } from '../agents/runner.js';
import { askText } from '../agents/llm.js';
import { retrieve } from '../agents/rag.js';

const r = Router();
r.use(requireAuth);
const mine = (req) => ({ _id: req.params.id, user: req.user._id });
const list = 'question region status createdAt report.verdict report.sources';

r.get('/', async (req, res) => {
  const rows = await Analysis.find({ user: req.user._id }).sort('-createdAt').limit(100).select(list).lean();
  res.json(rows.map(({ report, ...a }) => ({ ...a, verdict: report?.verdict, sources: report?.sources?.length })));
});

r.post('/', async (req, res) => {
  const question = String(req.body.question || '').trim();
  if (question.length < 10) return res.status(400).json({ error: 'Describe the decision in at least 10 characters.' });
  if (question.length > 600) return res.status(400).json({ error: 'Keep the question under 600 characters.' });
  const a = await Analysis.create({
    user: req.user._id, question, region: String(req.body.region || 'Pakistan-wide').slice(0, 40),
    depth: ['Quick', 'Standard', 'Deep'].includes(req.body.depth) ? req.body.depth : 'Standard',
    useDocs: !!req.body.useDocs, steps: newSteps(),
  });
  startPlan(a);
  res.status(201).json({ id: a._id });
});

r.get('/:id', async (req, res) => {
  const a = await Analysis.findOne(mine(req)).lean();
  a ? res.json(a) : res.status(404).json({ error: 'Analysis not found.' });
});

r.post('/:id/approve', async (req, res) => {
  const a = await Analysis.findOne(mine(req));
  if (!a) return res.status(404).json({ error: 'Analysis not found.' });
  if (a.status !== 'awaiting_approval') return res.status(409).json({ error: 'This analysis is not waiting for approval.' });
  const comps = (req.body.competitors || []).map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 8);
  if (!comps.length) return res.status(400).json({ error: 'Keep at least one competitor.' });
  a.plan.competitors = comps;
  await a.save();
  startPipeline(a._id);
  res.json({ ok: true });
});

// Server-sent events: snapshot first, then live updates.
r.get('/:id/stream', async (req, res) => {
  const a = await Analysis.findOne(mine(req)).lean();
  if (!a) return res.status(404).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (p) => res.write(`data: ${JSON.stringify(p)}\n\n`);
  send({ type: 'snapshot', analysis: a });
  const id = String(a._id);
  bus.on(id, send);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); bus.off(id, send); });
});

r.post('/:id/ask', async (req, res) => {
  const a = await Analysis.findOne(mine(req)).lean();
  if (!a?.report) return res.status(404).json({ error: 'Report not ready.' });
  const q = String(req.body.question || '').slice(0, 400);
  const docs = a.useDocs ? (await retrieve(req.user._id, q, 3)).map((h) => `(${h.docName}) ${h.text.slice(0, 400)}`).join('\n') : '';
  const { sources, ...rest } = a.report;
  const answer = await askText(`Answer using only this report and the extra passages. Cite as [n] from the sources list. If the answer is not covered, say so.\n\nREPORT: ${JSON.stringify(rest)}\nSOURCES: ${JSON.stringify(sources.map((s, i) => `[${i + 1}] ${s.title}`))}\nEXTRA: ${docs}\n\nQuestion: ${q}`);
  res.json({ answer });
});

r.delete('/:id', async (req, res) => { await Analysis.deleteOne(mine(req)); res.json({ ok: true }); });
export default r;
