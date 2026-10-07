import 'dotenv/config';
const e = process.env;
export const env = {
  port: +e.PORT || 5000,
  prod: e.NODE_ENV === 'production',
  mongo: e.MONGO_URI || 'mongodb://127.0.0.1:27017/verdict',
  jwt: e.JWT_SECRET,
  groqKey: e.GROQ_API_KEY,
  groqModel: e.GROQ_MODEL || 'llama-3.3-70b-versatile',
  groqTpm: +e.GROQ_TPM || 10000, // stay under the free-tier tokens-per-minute limit
  tavily: e.TAVILY_API_KEY,
};
if (!env.jwt || env.jwt.length < 16) throw new Error('Set JWT_SECRET (16+ characters) in server/.env');
