import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import { User } from '../models/index.js';

export async function requireAuth(req, res, next) {
  try {
    const { id } = jwt.verify(req.cookies.token, env.jwt);
    const user = await User.findById(id);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in to continue.' });
  }
}
