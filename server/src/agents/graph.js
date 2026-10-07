import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { askJSON, askText } from './llm.js';
import { forecast } from './tools.js';

// Supervisor pattern: the supervisor picks the next specialist, each specialist reports back.
const ORDER = ['research', 'market', 'competitor', 'customer', 'financial', 'report'];
const State = Annotation.Root({
  done: Annotation({ reducer: (a, b) => a.concat(b), default: () => [] }),
  data: Annotation({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  next: Annotation({ reducer: (_, b) => b, default: () => 'research' }),
});

const brief = (c) => `Business question: "${c.question}"\nRegion: ${c.region}. Use PKR for money amounts unless the question says otherwise.\nCite evidence as [n] using the numbered evidence below. If a number is not in the evidence, mark it as an assumption.`;

const agents = {
  async research(d, c) {
    const evidence = [];
    for (const q of [`${c.topic} market size ${c.region}`, `${c.topic} industry trends and regulation ${c.region}`]) evidence.push(await c.search(q));
    evidence.push(await c.docs(c.question));
    const text = await askText(`${brief(c)}\n\nEVIDENCE:\n${evidence.join('\n')}\n\nWrite 6 short bullet findings about the market, trends and regulation. Keep [n] citations.`);
    return { research: text, evidence: evidence.join('\n') };
  },
  async market(d, c) {
    c.emit('market', 'Sizing the market');
    return { market: await askJSON(`${brief(c)}\n\nEVIDENCE:\n${d.evidence}\n\nReturn {"marketSize":"short value e.g. PKR 180bn","basis":"sourced"|"assumed","note":"one sentence with [n] if sourced","trends":["3 short trends"]}`) };
  },
  async competitor(d, c) {
    const ev = [];
    for (const name of c.competitors.slice(0, 5)) ev.push(await c.search(`${name} pricing features ${c.region}`, 3));
    return { competitors: await askJSON(`${brief(c)}\n\nEVIDENCE:\n${ev.join('\n')}\n\nCompetitors: ${c.competitors.join(', ')}.\nReturn an array: [{"name":"","focus":"short","price":"text e.g. PKR 8-15k/mo or Commission or Unknown","priceMonthly":number or null,"threat":"High"|"Medium"|"Low","cite":[n]}]`) };
  },
  async customer(d, c) {
    const ev = await c.search(`${c.topic} customer needs pain points ${c.region}`, 4);
    return { customer: await askJSON(`${brief(c)}\n\nEVIDENCE:\n${ev}\n${await c.docs('customer survey pain points willingness to pay')}\n\nReturn {"segments":["3 short segments"],"painPoints":["3 short"],"willingnessToPay":"short text"}`) };
  },
  async financial(d, c) {
    c.emit('financial', 'Proposing assumptions, then calculating in code');
    const a = await askJSON(`${brief(c)}\n\nMarket: ${JSON.stringify(d.market)}\nCompetitors: ${JSON.stringify(d.competitors)}\n\nReturn realistic launch assumptions {"price":monthly price per customer in PKR,"startCustomers":number,"growth":monthly growth 0-0.2,"churn":monthly churn 0-0.1,"fixedCosts":monthly PKR,"costPerCustomer":monthly PKR,"notes":"one sentence"}`);
    const n = (v, f) => (Number.isFinite(+v) ? +v : f);
    const x = { price: n(a.price, 12500), startCustomers: n(a.startCustomers, 10), growth: n(a.growth, 0.08), churn: n(a.churn, 0.03), fixedCosts: n(a.fixedCosts, 400000), costPerCustomer: n(a.costPerCustomer, 2500) };
    return { financial: { ...x, notes: a.notes, ...forecast(x) } };
  },
  async report(d, c) {
    const prompt = `${brief(c)}\n\nFINDINGS:\n${d.research}\nMARKET: ${JSON.stringify(d.market)}\nCOMPETITORS: ${JSON.stringify(d.competitors)}\nCUSTOMERS: ${JSON.stringify(d.customer)}\nFINANCIALS: ${JSON.stringify(d.financial)}\n\nGive an honest recommendation, including reasons not to proceed when warranted.\nReturn {"verdict":"Go"|"Conditional go"|"No-go","confidence":0-100,"headline":"one line","summary":"3-4 sentences with [n] citations","swot":{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]},"risks":["3 short"]}`;
    const r = await askJSON(prompt);
    const fin = d.financial, comps = d.competitors || [];
    const priced = comps.filter((x) => Number.isFinite(+x.priceMonthly) && +x.priceMonthly > 0);
    return {
      report: {
        ...r,
        kpis: [
          { label: 'Market size', value: d.market?.marketSize || 'n/a', basis: d.market?.basis === 'sourced' ? 'sourced' : 'assumed' },
          { label: 'Competitors', value: String(comps.length), basis: 'sourced' },
          { label: 'Your price / mo', value: `PKR ${Math.round(fin.price).toLocaleString('en-PK')}`, basis: 'assumed' },
          { label: 'Break-even', value: fin.breakEven ? `Month ${fin.breakEven}` : 'Beyond 4 years', basis: 'estimate' },
        ],
        competitors: comps, market: d.market, customer: d.customer, financial: fin,
        pricing: [...priced.map((x) => ({ label: x.name, value: +x.priceMonthly })), { label: 'Your plan', value: Math.round(fin.price), you: true }],
        sources: c.sources,
      },
    };
  },
};

const wrap = (name) => async (s, config) => {
  const c = config.configurable.ctx;
  await c.step(name, 'running');
  const out = await agents[name](s.data, c);
  await c.step(name, 'done');
  return { done: [name], data: out };
};

export const pipeline = (() => {
  const g = new StateGraph(State).addNode('supervisor', (s) => ({ next: ORDER.find((a) => !s.done.includes(a)) || 'FINISH' }));
  for (const a of ORDER) { g.addNode(a, wrap(a)); g.addEdge(a, 'supervisor'); }
  g.addEdge(START, 'supervisor');
  g.addConditionalEdges('supervisor', (s) => (s.next === 'FINISH' ? END : s.next));
  return g.compile();
})();

export const planTopic = (q, region) => askJSON(`A founder asks: "${q}" (region: ${region}).\nReturn {"topic":"3-6 word search topic","competitors":["5 real competitors or substitutes relevant to ${region}"],"focus":["3 short research focus areas"]}`);
