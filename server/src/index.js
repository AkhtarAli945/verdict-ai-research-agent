
// import express from 'express';
// import mongoose from 'mongoose';
// import helmet from 'helmet';
// import cookieParser from 'cookie-parser';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { env } from './config.js';
// import auth from './routes/auth.js';
// import analyses from './routes/analyses.js';
// import documents from './routes/documents.js';
// import { Analysis } from './models/index.js';
// import { warmEmbeddings } from './agents/llm.js';

// // A background error (for example a dropped database connection) should be logged, not crash the whole API.
// process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
// process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
// mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected, retrying...'));
// mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

// const app = express();
// app.set('trust proxy', 1);
// app.use(helmet());
// app.use(express.json({ limit: '1mb' }));
// app.use(cookieParser());

// app.get('/api/health', (_q, res) => res.json({ ok: true }));
// app.use('/api/auth', auth);
// app.use('/api/analyses', analyses);
// app.use('/api/documents', documents);
// app.use('/api', (_q, res) => res.status(404).json({ error: 'Not found.' }));

// // In production the server also serves the built React app.
// const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
// app.use(express.static(dist));
// app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html'), (e) => e && next()) : next()));

// app.use((err, _req, res, _next) => {
//   console.error(err);
//   res.status(err.status || 500).json({ error: err.status ? err.message : err.message?.startsWith('Only ') ? err.message : 'Something went wrong on the server.' });
// });

// await mongoose.connect(env.mongo, { serverSelectionTimeoutMS: 15000 });
// console.log('MongoDB connected');
// // Analyses run in memory. If the server restarted mid-run, close them out instead of leaving them spinning forever.
// const stale = await Analysis.updateMany({ status: { $in: ['planning', 'running'] } }, { status: 'failed', error: 'The server restarted while this analysis was running. Please start it again.' });
// if (stale.modifiedCount) console.log(`Marked ${stale.modifiedCount} interrupted analysis(es) as failed`);
// app.listen(env.port, () => console.log(`Verdict API on http://localhost:${env.port}`));
// warmEmbeddings();





import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import auth from './routes/auth.js';
import analyses from './routes/analyses.js';
import documents from './routes/documents.js';
import { Analysis } from './models/index.js';
import { warmEmbeddings } from './agents/llm.js';

dns.setDefaultResultOrder('ipv4first');
// Optional: use public DNS for mongodb+srv lookups when your ISP's DNS fails (set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env)
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((x) => x.trim()).filter(Boolean));

// A background error (for example a dropped database connection) should be logged, not crash the whole API.
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected, retrying...'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

// Keep trying instead of exiting, so a short internet or DNS problem does not leave the API dead.
async function connectDb() {
  for (let i = 1; ; i++) {
    try { await mongoose.connect(env.mongo, { serverSelectionTimeoutMS: 15000 }); return; }
    catch (e) {
      console.error(`MongoDB connect attempt ${i} failed: ${String(e.message).split('\n')[0].slice(0, 160)}`);
      console.error('Check: internet and DNS, Atlas > Network Access (0.0.0.0/0), and MONGO_URI in server/.env. Retrying in 10 seconds...');
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_q, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/analyses', analyses);
app.use('/api/documents', documents);
app.use('/api', (_q, res) => res.status(404).json({ error: 'Not found.' }));

// In production the server also serves the built React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
app.use(express.static(dist));
app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html'), (e) => e && next()) : next()));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : err.message?.startsWith('Only ') ? err.message : 'Something went wrong on the server.' });
});

await connectDb();
console.log('MongoDB connected');
// Analyses run in memory. If the server restarted mid-run, close them out instead of leaving them spinning forever.
const stale = await Analysis.updateMany({ status: { $in: ['planning', 'running'] } }, { status: 'failed', error: 'The server restarted while this analysis was running. Please start it again.' });
if (stale.modifiedCount) console.log(`Marked ${stale.modifiedCount} interrupted analysis(es) as failed`);
const server = app.listen(env.port, () => console.log(`Verdict API on http://localhost:${env.port}`));
// Keep idle connections open longer than the dev proxy does, so it never reuses a socket we already closed (prevents ECONNRESET noise).
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
warmEmbeddings();
