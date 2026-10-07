import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config.js';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } }));
const cookie = { httpOnly: true, sameSite: 'lax', secure: env.prod, maxAge: 7 * 24 * 3600 * 1000 };
const pub = (u) => ({ id: u._id, name: u.name, email: u.email });

// Register creates the account only. No session is started: the user must sign in next.
r.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password))
    return res.status(400).json({ error: 'Password needs 8+ characters with a letter and a number.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  await User.create({ name, email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ message: 'Account created. Sign in to continue.' });
});

r.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  const ok = user && (await bcrypt.compare(String(req.body.password || ''), user.password));
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.cookie('token', jwt.sign({ id: user._id }, env.jwt, { expiresIn: '7d' }), cookie).json({ user: pub(user) });
});

r.post('/logout', (_req, res) => res.clearCookie('token', { ...cookie, maxAge: undefined }).json({ ok: true }));
r.get('/me', requireAuth, (req, res) => res.json({ user: pub(req.user) }));
export default r;
