import { useState } from 'react';
import { api } from '../api.js';

export function VerdictChip({ v, status }) {
  if (!v) return <span className={'chip' + (status === 'failed' ? ' bad' : '')}>{status === 'failed' ? 'Failed' : 'In progress'}</span>;
  return <span className={'chip ' + (v === 'Go' ? 'ok' : v === 'No-go' ? 'bad' : 'warn')}>{v}</span>;
}
const cite = (t = '') => String(t).split(/(\[\d+\])/g).map((p, i) => (/^\[\d+\]$/.test(p) ? <sup key={i}>{p.slice(1, -1)}</sup> : p));
const pkr = (n) => `PKR ${Math.round(n).toLocaleString('en-PK')}`;
const big = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}bn` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : `${Math.round(n / 1e3)}k`);

function Forecast({ years }) {
  const max = Math.max(...years, 1), xs = [20, 100, 180, 260], ys = years.map((v) => 108 - (v / max) * 84);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  return (
    <svg viewBox="0 0 300 140" width="100%" role="img" aria-label={`Revenue forecast: ${years.map((y, i) => `year ${i + 1} ${pkr(y)}`).join(', ')}`}>
      <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--acc)" stopOpacity=".35" /><stop offset="1" stopColor="var(--acc)" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} 260,116 20,116`} fill="url(#fg)" />
      <polyline points={pts} fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => <g key={x} fontSize="10" fill="var(--mut)" textAnchor="middle"><circle cx={x} cy={ys[i]} r="3.5" fill="var(--acc)" /><text x={x} y={ys[i] - 9}>{big(years[i])}</text><text x={x} y="132">Y{i + 1}</text></g>)}
    </svg>
  );
}

export default function Report({ a }) {
  const r = a.report;
  const [q, setQ] = useState('What are the biggest risks?');
  const [ans, setAns] = useState('');
  const [busy, setBusy] = useState(false);
  async function ask() { setBusy(true); try { setAns((await api(`/analyses/${a._id}/ask`, { method: 'POST', body: { question: q } })).answer); } catch (e) { setAns(e.message); } setBusy(false); }
  const maxP = Math.max(...r.pricing.map((p) => p.value), 1);
  const cls = r.verdict === 'Go' ? 'ok' : r.verdict === 'No-go' ? 'bad' : 'warn';

  return (
    <>
      <header className="top"><div><h1>{a.question}</h1><p className="sub">{a.region} · {new Date(a.createdAt).toLocaleDateString('en-PK')} · {r.sources.length} sources</p></div>
        <div className="row noprint"><button className="btn" onClick={() => window.print()}>Export PDF</button></div></header>
      <div className="rep">
        <div>
          <div className="card verdict"><div className="ring" style={{ '--v': r.confidence }} role="img" aria-label={`${r.confidence}% confidence`}><span>{r.confidence}%</span></div>
            <div><span className={'chip ' + cls}>{r.verdict}</span><h2>{r.headline}</h2><p className="sub">{cite(r.summary)}</p></div></div>
          <div className="grid g4 sec">{r.kpis.map((k) => <div key={k.label} className="card kpi"><small>{k.label}</small><strong>{k.value}</strong><span className={'chip ' + (k.basis === 'sourced' ? 'ok' : k.basis === 'estimate' ? 'warn' : '')}>{k.basis}</span></div>)}</div>
          {r.competitors?.length > 0 && <div className="card sec"><h2>Competitors</h2><div className="tw"><table className="rt"><thead><tr><th>Company</th><th>Focus</th><th>Price</th><th>Threat</th></tr></thead><tbody>
            {r.competitors.map((c) => <tr key={c.name}><td data-l="Company"><b>{c.name}</b>{(c.cite || []).map((n) => <sup key={n}>{n}</sup>)}</td><td data-l="Focus">{c.focus}</td><td data-l="Price">{c.price}</td><td data-l="Threat"><span className={'chip ' + (c.threat === 'High' ? 'bad' : c.threat === 'Low' ? 'ok' : 'warn')}>{c.threat}</span></td></tr>)}</tbody></table></div></div>}
          <div className="card sec"><h2>SWOT</h2><div className="swot">{[['s', 'Strengths', 'strengths'], ['w', 'Weaknesses', 'weaknesses'], ['o', 'Opportunities', 'opportunities'], ['t', 'Threats', 'threats']].map(([c, t, k]) => <div key={k} className={c}><h3>{t}</h3><ul>{(r.swot?.[k] || []).map((x, i) => <li key={i}>{cite(x)}</li>)}</ul></div>)}</div></div>
          <div className="grid g2 sec">
            <div className="card"><h2>Pricing per month</h2>{r.pricing.map((p) => <div className="hb" key={p.label}><span>{p.label}</span><i style={{ width: `${Math.max(6, (p.value / maxP) * 100)}%`, background: p.you ? 'var(--ok)' : undefined }} /><u>{pkr(p.value)}</u></div>)}</div>
            <div className="card"><h2>Revenue forecast</h2><Forecast years={r.financial.years} /><p className="sub small">Calculated in code from assumptions: {r.financial.notes}</p></div>
          </div>
          {r.risks?.length > 0 && <div className="card sec"><h2>Main risks</h2><ul className="plain">{r.risks.map((x, i) => <li key={i}>{cite(x)}</li>)}</ul></div>}
          <div className="card sec noprint"><h2>Ask this report</h2><div className="row"><input className="in grow" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} /><button className="btn" onClick={ask} disabled={busy}>{busy ? 'Thinking…' : 'Ask'}</button></div>{ans && <div className="ans">{cite(ans)}</div>}</div>
        </div>
        <div className="card srcs"><h2>Sources</h2><p className="sub small">Numbers in the report match this list.</p>
          {r.sources.map((s, i) => <div key={i}><sup>{i + 1}</sup> {s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title} <span className="src">{s.type === 'upload' ? 'your file' : 'web'}</span></div>)}
          {!r.sources.length && <p className="sub">No sources were found. Treat figures as assumptions.</p>}</div>
      </div>
    </>
  );
}
