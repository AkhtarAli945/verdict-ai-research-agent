
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatGroq } from '@langchain/groq';
import { env } from '../config.js';

let chat;
export function llm() {
  if (chat) return chat;
  if (!env.groqKey) throw new Error('Missing GROQ_API_KEY in server/.env. Get a free key at console.groq.com/keys');
  const reasoning = /gpt-oss/.test(env.groqModel); // reasoning models spend tokens thinking, so keep effort low and allow more output
  chat = new ChatGroq({ model: env.groqModel, temperature: 0.2, maxTokens: reasoning ? 4000 : 1800, apiKey: env.groqKey, maxRetries: 1, timeout: 90000, ...(reasoning && { reasoningEffort: 'low' }) });
  return chat;
}

// ---- Free-tier pacing -------------------------------------------------------------
// Groq's free tier limits tokens per minute. We estimate usage over a rolling 60s window,
// wait when a call would exceed it, and retry on 429 using the delay Groq asks for.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BUDGET = env.groqTpm;
const window = [];
async function pace(tokens) {
  for (;;) {
    const now = Date.now();
    while (window.length && now - window[0].t > 60000) window.shift();
    const used = window.reduce((s, x) => s + x.n, 0);
    if (used + tokens <= BUDGET || !window.length) break;
    await sleep(Math.max(500, 60000 - (now - window[0].t) + 200));
  }
  window.push({ t: Date.now(), n: tokens });
}
const retryDelay = (e) => {
  const m = String(e?.message || '').match(/try again in ([\d.]+)\s*(ms|s|m)/i);
  return m ? Math.ceil(parseFloat(m[1]) * ({ ms: 1, s: 1000, m: 60000 }[m[2].toLowerCase()])) + 500 : 8000;
};
const toText = (r) => (typeof r.content === 'string' ? r.content : r.content.map((c) => c.text || '').join(''));

export async function askText(prompt) {
  await pace(Math.ceil(prompt.length / 3.5) + 1800);
  for (let i = 0; ; i++) {
    try { return toText(await llm().invoke(prompt)).trim(); }
    catch (e) {
      const limited = e?.status === 429 || /rate.?limit|429|tokens per minute/i.test(String(e?.message));
      const flaky = /timed out|timeout|ECONN|EAI_AGAIN|ETIMEDOUT|fetch failed|connection error|socket/i.test(String(e?.message) + String(e?.name));
      if ((!limited && !flaky) || i >= 4) throw limited ? new Error('Groq free-tier rate limit reached. Wait a minute and try again.') : e;
      await sleep(limited ? retryDelay(e) : 5000 * (i + 1));
    }
  }
}

// Ask for JSON and parse it. One retry if the model wraps or breaks the JSON.
export async function askJSON(prompt) {
  for (let i = 0; ; i++) {
    const text = await askText(`${prompt}\n\nReturn ONLY valid JSON. No markdown fences, no commentary.`);
    try { return JSON.parse(text.match(/[\[{][\s\S]*[\]}]/)[0]); }
    catch { if (i >= 1) throw new Error('The model returned invalid JSON. Try again.'); }
  }
}

// ---- Free local embeddings --------------------------------------------------------
// all-MiniLM-L6-v2 runs on your machine (no API key). First use downloads ~25 MB once.
// If the model cannot load, a keyword-hash embedding is used so uploads still work.
// Every vector is stored with the kind that made it, so search always uses the same kind.
let extractor;
// Looks in server/models first (manual download), then Hugging Face (or HF_REMOTE_HOST mirror). Small 8-bit model, about 23 MB.
const load = () => (extractor ??= import('@huggingface/transformers').then((m) => {
  m.env.localModelPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../models') + path.sep;
  if (process.env.HF_REMOTE_HOST) m.env.remoteHost = process.env.HF_REMOTE_HOST;
  return m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
}));
// Called at server start so the model is ready before the first upload. Retries a few times on flaky connections.
export async function warmEmbeddings() {
  for (let i = 1; i <= 3; i++) {
    try { await load(); console.log('[embeddings] local model ready'); return true; }
    catch (e) { extractor = undefined; console.warn(`[embeddings] load attempt ${i} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 3000)); }
  }
  console.warn('[embeddings] using keyword fallback. See README: "Embedding model download".');
  return false;
}
export function hashEmbed(text, dim = 512) {
  const v = new Array(dim).fill(0);
  for (const w of text.toLowerCase().match(/[a-z0-9]{2,}/g) || []) { let h = 2166136261; for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); v[(h >>> 0) % dim] += 1; }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}
let warned = false;
const fail = (e) => { if (!warned) { warned = true; console.warn('[embeddings] local model unavailable, using keyword fallback:', e.message); } extractor = undefined; };

// Embed texts. Returns { vecs, kind } where kind is 'minilm' or 'hash'.
export async function embedTexts(texts) {
  try { return { vecs: (await (await load())(texts, { pooling: 'mean', normalize: true })).tolist(), kind: 'minilm' }; }
  catch (e) { fail(e); return { vecs: texts.map((t) => hashEmbed(t)), kind: 'hash' }; }
}
// Embed one query with a specific kind. Returns null if that kind is not available right now.
export async function embedAs(kind, text) {
  if (kind === 'hash') return hashEmbed(text);
  const r = await embedTexts([text]);
  return r.kind === kind ? r.vecs[0] : null;
}
