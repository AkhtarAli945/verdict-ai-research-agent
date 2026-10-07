import { env } from '../config.js';

export async function tavilySearch(query, max = 5) {
  if (!env.tavily) return null;
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.tavily}` },
    body: JSON.stringify({ query, max_results: max, search_depth: 'basic' }),
  });
  if (!r.ok) throw new Error(`Web search failed (${r.status}). Check TAVILY_API_KEY.`);
  return (await r.json()).results || [];
}

// Deterministic financial model. The LLM only proposes assumptions; the math is done here.
export function forecast({ price, startCustomers, growth, churn, fixedCosts, costPerCustomer }) {
  const years = [0, 0, 0, 0];
  let c = startCustomers, breakEven = null;
  for (let m = 1; m <= 48; m++) {
    c = Math.max(0, c * (1 + growth - churn));
    const profit = c * price - (fixedCosts + c * costPerCustomer);
    years[Math.floor((m - 1) / 12)] += c * price;
    if (breakEven === null && profit >= 0) breakEven = m;
  }
  return { years: years.map(Math.round), breakEven };
}
