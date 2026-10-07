import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Report from '../components/Report.jsx';

const LABEL = { plan: 'Plan the research', research: 'Research', market: 'Market sizing', competitor: 'Competitor analysis', customer: 'Customers and pricing', financial: 'Financial model', report: 'Write the report' };
const LIVE = ['planning', 'awaiting_approval', 'running'];

export default function Analysis() {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let es, off = false;
    api(`/analyses/${id}`).then((d) => {
      if (off) return;
      setA(d);
      if (!LIVE.includes(d.status)) return;
      es = new EventSource(`/api/analyses/${id}/stream`);
      es.onmessage = (m) => {
        const p = JSON.parse(m.data);
        if (p.type === 'snapshot') { setA(p.analysis); if (!LIVE.includes(p.analysis.status)) es.close(); }
        else if (p.type === 'log') setA((x) => x && { ...x, events: [...x.events, p] });
      };
    }).catch((e) => setErr(e.message));
    return () => { off = true; es?.close(); };
  }, [id]);

  if (err) return <div className="card empty">{err} <Link to="/">Back to start</Link></div>;
  if (!a) return <div className="splash"><span className="spin" /></div>;
  if (a.status === 'done') return <Report a={a} />;

  const done = a.steps.filter((s) => s.status === 'done').length;
  return (
    <>
      <header className="top"><div><h1>{a.status === 'failed' ? 'This analysis stopped' : 'Researching…'}</h1><p className="sub">{a.question}</p></div>{a.status !== 'failed' && <span className="chip">{Math.round((done / a.steps.length) * 100)}%</span>}</header>
      {a.status === 'failed' && <div className="alert bad" role="alert">{a.error} <Link to="/">Start a new analysis</Link></div>}
      {a.status === 'awaiting_approval' && <Plan a={a} />}
      <div className="live">
        <div className="card">{a.steps.map((s) => (
          <div key={s.name} className={'step ' + (s.status === 'done' ? 'done' : s.status === 'running' ? 'run' : '')}><div className="dot">{s.status === 'done' ? '✓' : ''}</div><b>{LABEL[s.name]}</b></div>))}</div>
        <div className="card"><h3>Live activity</h3>
          <div className="feed" aria-live="polite">{[...a.events].reverse().map((e, i) => <div key={i}><em>{e.agent}</em> {e.msg}</div>)}{!a.events.length && <div>Waiting for the first update…</div>}</div></div>
      </div>
    </>
  );
}

function Plan({ a }) {
  const [comps, setComps] = useState(a.plan.competitors || []);
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const addOne = () => { const v = add.trim(); if (v && !comps.includes(v)) setComps([...comps, v]); setAdd(''); };
  async function approve() {
    setBusy(true); setErr('');
    try { await api(`/analyses/${a._id}/approve`, { method: 'POST', body: { competitors: comps } }); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div className="plan">
      <b>Review the research plan</b>
      <p className="sub">Topic: {a.plan.topic}. Remove competitors that do not belong, or add your own.</p>
      <div className="row tight">{comps.map((c) => <button key={c} className="opt on" onClick={() => setComps(comps.filter((x) => x !== c))} aria-label={`Remove ${c}`}>{c} ✕</button>)}</div>
      <div className="row tight"><input className="in" placeholder="Add a competitor" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOne()} /><button className="btn g" onClick={addOne}>Add</button></div>
      {a.plan.focus?.length > 0 && <ul className="focus">{a.plan.focus.map((f) => <li key={f}>{f}</li>)}</ul>}
      {err && <div className="alert bad">{err}</div>}
      <button className="btn" onClick={approve} disabled={busy || !comps.length}>{busy ? 'Starting…' : 'Approve and continue'}</button>
    </div>
  );
}
