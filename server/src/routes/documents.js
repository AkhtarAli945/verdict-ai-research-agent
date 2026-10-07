import { Router } from 'express';
import multer from 'multer';
import { Doc, Chunk } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ingest, retrieve } from '../agents/rag.js';
import { askText } from '../agents/llm.js';

const ok = /\.(pdf|csv|txt|md)$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 }, fileFilter: (_q, f, cb) => cb(ok.test(f.originalname) ? null : new Error('Only PDF, CSV, TXT and MD files are supported.'), ok.test(f.originalname)) });
const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => res.json(await Doc.find({ user: req.user._id }).sort('-createdAt').lean()));
r.post('/', upload.array('files', 5), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one file.' });
  res.status(201).json(await Promise.all(req.files.map((f) => ingest(req.user._id, f))));
});
r.delete('/:id', async (req, res) => {
  const d = await Doc.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (d) await Chunk.deleteMany({ doc: d._id });
  res.json({ ok: true });
});
r.post('/ask', async (req, res) => {
  const q = String(req.body.question || '').slice(0, 400);
  if (q.length < 3) return res.status(400).json({ error: 'Type a question.' });
  const hits = await retrieve(req.user._id, q, 5);
  if (!hits.length) return res.json({ answer: 'No indexed documents yet. Upload a file first.', sources: [] });
  const ctx = hits.map((h, i) => `[${i + 1}] (${h.docName}${h.page ? ` p.${h.page}` : ''}) ${h.text}`).join('\n');
  const answer = await askText(`Answer only from these passages. Cite as [n]. If the passages do not answer it, say so.\n\n${ctx}\n\nQuestion: ${q}`);
  res.json({ answer, sources: hits.map((h, i) => ({ n: i + 1, title: h.docName + (h.page ? ` p.${h.page}` : '') })) });
});
export default r;
