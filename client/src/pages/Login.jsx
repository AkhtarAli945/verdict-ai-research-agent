import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState(loc.state?.registered || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(email, password); nav(loc.state?.from || '/', { replace: true }); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <AuthShell title="Sign in" sub="Welcome back." footer={<>New here? <Link to="/register">Create an account</Link></>}>
      <form onSubmit={submit}>
        {loc.state?.registered && <div className="alert ok" role="status">Account created. Sign in to continue.</div>}
        {err && <div className="alert bad" role="alert">{err}</div>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus={!email} /></label>
        <label>Password
          <span className="pw"><input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus={!!email} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
        </label>
        <button className="btn full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}
