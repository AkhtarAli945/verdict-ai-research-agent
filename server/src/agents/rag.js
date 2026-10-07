import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Doc, Chunk } from '../models/index.js';
import { embedTexts, embedAs } from './llm.js';

function split(text, size = 900, overlap = 120) {
  const out = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    const c = text.slice(i, i + size).trim();
    if (c.length > 40) out.push(c);
  }
  return out;
}

async function readPages(file) {
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    const pages = [];
    await pdf(file.buffer, { pagerender: async (p) => { const t = (await p.getTextContent()).items.map((i) => i.str).join(' '); pages.push(t); return t; } });
    return { ext, pages };
  }
  return { ext, pages: [file.buffer.toString('utf8')] };
}

// Parse, chunk, embed and store an uploaded file. Runs in the background.
export async function ingest(userId, file) {
  const doc = await Doc.create({ user: userId, name: file.originalname });
  (async () => {
    try {
      const { ext, pages } = await readPages(file);
      const rows = pages.flatMap((t, i) => split(t).map((text) => ({ text, page: i + 1 })));
      if (!rows.length) throw new Error('No readable text found in this file.');
      for (let i = 0; i < rows.length; i += 40) {
        const batch = rows.slice(i, i + 40);
        const { vecs, kind } = await embedTexts(batch.map((r) => r.text));
        await Chunk.insertMany(batch.map((r, k) => ({ user: userId, doc: doc._id, docName: doc.name, page: ext === 'pdf' ? r.page : undefined, text: r.text, model: kind, embedding: vecs[k] })));
      }
      await Doc.updateOne({ _id: doc._id }, { type: ext, pages: pages.length, chunks: rows.length, status: 'indexed' });
    } catch (err) {
      await Chunk.deleteMany({ doc: doc._id });
      await Doc.updateOne({ _id: doc._id }, { status: 'failed', error: err.message });
    }
  })();
  return doc;
}

const cosine = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / (Math.sqrt(x * y) || 1); };
const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const keywordScore = (q, text) => { const a = words(q), b = words(text); let n = 0; for (const w of a) if (b.has(w)) n++; return (n / (a.size || 1)) * 0.5; };

// Top-k chunks from this user's documents. Each chunk is searched with the same kind of embedding that created it.
// Fine for personal-scale data; switch to Atlas Vector Search when it grows.
export async function retrieve(userId, query, k = 5) {
  const chunks = await Chunk.find({ user: userId }).select('+embedding');
  if (!chunks.length) return [];
  const kindOf = (c) => c.model || (c.embedding.length === 512 ? 'hash' : 'minilm');
  const groups = {};
  for (const c of chunks) (groups[kindOf(c)] ??= []).push(c);
  const scored = [];
  for (const [kind, list] of Object.entries(groups)) {
    const q = await embedAs(kind, query);
    for (const c of list) {
      const ok = q && q.length === c.embedding.length;
      scored.push({ text: c.text, docName: c.docName, page: c.page, score: ok ? cosine(q, c.embedding) : keywordScore(query, c.text) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
