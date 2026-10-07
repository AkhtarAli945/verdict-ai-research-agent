import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [q, setQ] = useState('');
  const [ans, setAns] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const load = useCallback(() => api('/documents').then(setDocs).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!docs.some((d) => d.status === 'indexing')) return; const t = setInterval(load, 3000); return () => clearInterval(t); }, [docs, load]);

  async function upload(files) {
    if (!files?.length) return;
    setErr('');
    const form = new FormData();
    [...files].forEach((f) => form.append('files', f));
    try { await api('/documents', { method: 'POST', form }); load(); } catch (e) { setErr(e.message); }
  }
  async function ask() {
    setBusy(true); setAns(null);
    try { setAns(await api('/documents/ask', { method: 'POST', body: { question: q } })); } catch (e) { setAns({ answer: e.message, sources: [] }); }
    setBusy(false);
  }
  const chip = (s) => <span className={'chip ' + (s === 'indexed' ? 'ok' : s === 'failed' ? 'bad' : 'warn')}>{s === 'indexed' ? 'Indexed' : s === 'failed' ? 'Failed' : 'Indexing…'}</span>;

  return (
    <>
      <header className="top"><div><h1>Documents</h1><p className="sub">Files Verdict can cite next to web research. PDF, CSV, TXT or MD, up to 10 MB.</p></div><button className="btn" onClick={() => input.current.click()}>Upload files</button></header>
      <input ref={input} type="file" multiple hidden accept=".pdf,.csv,.txt,.md" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      <div className={'drop' + (drag ? ' on' : '')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}>
        <b>Drop files here</b><p>Market studies, competitor sheets, surveys, financials</p></div>
      {err && <div className="alert bad" role="alert">{err}</div>}
      {docs.length ? <div className="card tw sec"><table><thead><tr><th>Document</th><th>Type</th><th>Passages</th><th>Status</th><th /></tr></thead><tbody>
        {docs.map((d) => <tr key={d._id}><td>{d.name}{d.error && <small className="err"> {d.error}</small>}</td><td>{d.type?.toUpperCase()}</td><td>{d.chunks || '-'}</td><td>{chip(d.status)}</td>
          <td><button className="btn g sm" onClick={() => confirm(`Delete ${d.name}?`) && api(`/documents/${d._id}`, { method: 'DELETE' }).then(load)}>Delete</button></td></tr>)}</tbody></table></div>
        : <div className="card empty sec">No documents yet. Upload a report to get cited answers from your own material.</div>}
      <div className="card sec"><h2>Ask your documents</h2><div className="row"><input className="in grow" placeholder="e.g. What are the biggest risks in our market reports?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q.length > 2 && ask()} /><button className="btn" onClick={ask} disabled={busy || q.length < 3}>{busy ? 'Searching…' : 'Ask'}</button></div>
        {ans && <div className="ans">{ans.answer}{ans.sources?.map((s) => <span key={s.n} className="src">[{s.n}] {s.title}</span>)}</div>}</div>
    </>
  );
}
