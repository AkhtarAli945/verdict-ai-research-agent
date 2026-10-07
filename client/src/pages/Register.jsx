import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: f });
      // Account created, but no session yet: send the user to sign in.
      nav('/login', { replace: true, state: { registered: f.email } });
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Create your account" sub="It takes a minute. You will sign in on the next screen." footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
      <form onSubmit={submit} noValidate>
        {err && <div className="alert bad" role="alert">{err}</div>}
        <label>Full name<input value={f.name} onChange={set('name')} autoComplete="name" required /></label>
        <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
        <label>Password
          <span className="pw"><input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} autoComplete="new-password" required />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
          <small>8+ characters with a letter and a number.</small>
        </label>
        <button className="btn full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
