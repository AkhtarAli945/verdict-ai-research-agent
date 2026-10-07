import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { VerdictChip } from '../components/Report.jsx';

const REGIONS = ['Pakistan-wide', 'Karachi', 'Lahore', 'Islamabad'];
const EXAMPLES = ['Should we launch an AI SaaS for restaurants in Pakistan?', 'Is there room for an AI inventory tool for Pakistani bakeries?', 'Should we build COD reconciliation for Shopify sellers in Pakistan?'];
const AGENTS = [['🔎', 'Research'], ['📈', 'Market'], ['🏁', 'Competitor'], ['👥', 'Customer'], ['💰', 'Financial'], ['📝', 'Report']];

export default function New() {
  const nav = useNavigate();
  const [q, setQ] = useState(EXAMPLES[0]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [depth, setDepth] = useState('Standard');
  const [useDocs, setUseDocs] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/analyses').then((r) => setRecent(r.slice(0, 3))).catch(() => {});
    api('/documents').then((d) => { const n = d.filter((x) => x.status === 'indexed').length; setDocCount(n); setUseDocs(n > 0); }).catch(() => {});
  }, []);

  async function start() {
    setErr(''); setBusy(true);
    try { nav(`/analyses/${(await api('/analyses', { method: 'POST', body: { question: q, region, depth, useDocs } })).id}`); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <>
      <header className="top"><div><h1>What business decision do you need to make?</h1><p className="sub">Verdict researches the web and your documents, then writes a cited report.</p></div></header>
      <div className="card hero">
        <label className="lbl" htmlFor="q">Your question</label>
        <textarea id="q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} />
        <div className="row tight"><span className="sub">Try:</span>{EXAMPLES.slice(1).map((x) => <button key={x} className="opt" onClick={() => setQ(x)}>{x}</button>)}</div>
        <div className="row opts"><span className="sub">Where</span>{REGIONS.map((r) => <button key={r} className={'opt' + (r === region ? ' on' : '')} onClick={() => setRegion(r)}>{r}</button>)}</div>
        <div className="row opts"><span className="sub">Depth</span>{['Quick', 'Standard', 'Deep'].map((d) => <button key={d} className={'opt' + (d === depth ? ' on' : '')} onClick={() => setDepth(d)}>{d}</button>)}
          <label className={'opt chk' + (useDocs ? ' on' : '')}><input type="checkbox" checked={useDocs} disabled={!docCount} onChange={(e) => setUseDocs(e.target.checked)} />
            {docCount ? `Use my documents (${docCount})` : <>No documents yet. <Link to="/documents">Upload</Link></>}</label></div>
        {err && <div className="alert bad" role="alert">{err}</div>}
        <div className="row"><button className="btn" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start analysis'}</button><span className="sub small">You review the plan before research begins.</span></div>
        <div className="agents">{AGENTS.map(([i, n]) => <div key={n}><b>{i}</b>{n}</div>)}</div>
      </div>
      <h2 className="sech">Recent analyses</h2>
      {recent.length ? <div className="grid g3">{recent.map((a) => (
        <Link key={a._id} to={`/analyses/${a._id}`} className="card lnk"><VerdictChip v={a.verdict} status={a.status} /><h3>{a.question}</h3><p className="sub">{a.region} · {new Date(a.createdAt).toLocaleDateString('en-PK')}</p></Link>))}</div>
        : <div className="card empty">No analyses yet. Ask your first question above.</div>}
    </>
  );
}
