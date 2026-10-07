import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { VerdictChip } from '../components/Report.jsx';

export default function History() {
  const [rows, setRows] = useState(null);
  const load = () => api('/analyses').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <div className="splash"><span className="spin" /></div>;
  return (
    <>
      <header className="top"><div><h1>History</h1><p className="sub">All your past analyses.</p></div><Link className="btn" to="/">New analysis</Link></header>
      {rows.length ? <div className="card tw"><table className="rt"><thead><tr><th>Question</th><th>Verdict</th><th>Date</th><th /></tr></thead><tbody>
        {rows.map((a) => <tr key={a._id}><td data-l="Question"><Link to={`/analyses/${a._id}`}>{a.question}</Link></td><td data-l="Verdict"><VerdictChip v={a.verdict} status={a.status} /></td><td data-l="Date">{new Date(a.createdAt).toLocaleDateString('en-PK')}</td>
          <td><button className="btn g sm" onClick={() => confirm('Delete this analysis?') && api(`/analyses/${a._id}`, { method: 'DELETE' }).then(load)}>Delete</button></td></tr>)}</tbody></table></div>
        : <div className="card empty">Nothing here yet. <Link to="/">Run your first analysis</Link>.</div>}
    </>
  );
}
