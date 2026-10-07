
import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const id = { type: Schema.Types.ObjectId, required: true, index: true };

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
}, { timestamps: true }));

export const Doc = model('Doc', new Schema({
  user: id, name: String, type: String, pages: Number, chunks: { type: Number, default: 0 },
  status: { type: String, enum: ['indexing', 'indexed', 'failed'], default: 'indexing' }, error: String,
}, { timestamps: true }));

export const Chunk = model('Chunk', new Schema({
  user: id, doc: { type: Schema.Types.ObjectId, index: true }, docName: String, page: Number,
  text: String, model: String, embedding: { type: [Number], select: false },
}));

export const STEPS = ['plan', 'research', 'market', 'competitor', 'customer', 'financial', 'report'];

export const Analysis = model('Analysis', new Schema({
  user: id, question: { type: String, required: true }, region: String, depth: String, useDocs: Boolean,
  status: { type: String, enum: ['planning', 'awaiting_approval', 'running', 'done', 'failed'], default: 'planning' },
  plan: { topic: String, competitors: [String], focus: [String] },
  steps: [{ _id: false, name: String, status: { type: String, default: 'queued' } }],
  events: [{ _id: false, agent: String, msg: String, at: { type: Date, default: Date.now } }],
  report: Schema.Types.Mixed, error: String,
}, { timestamps: true }));
