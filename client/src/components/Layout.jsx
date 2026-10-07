import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV = [['/', '✦', 'New'], ['/documents', '❖', 'Documents'], ['/history', '↺', 'History']];

export function Logo() { return <div className="logo"><i>✓</i><span>Verdict</span></div>; }

export function useTheme() {
  const [t, setT] = useState(() => localStorage.getItem('theme') || '');
  useEffect(() => {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    t ? localStorage.setItem('theme', t) : localStorage.removeItem('theme');
  }, [t]);
  return [t, () => setT((x) => (x === 'dark' ? 'light' : 'dark'))];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [, toggle] = useTheme();
  return (
    <div className="app">
      <aside>
        <Logo />
        <nav>
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <b>{icon}</b><span>{label}</span>
            </NavLink>
          ))}
          <button className="navbtn" onClick={logout} aria-label="Sign out"><b>⎋</b><span>Sign out</span></button>
        </nav>
        <div className="foot">
          <div className="who"><strong>{user.name}</strong><small>{user.email}</small></div>
          <div className="row"><button className="btn g sm" onClick={toggle}>◐ Theme</button><button className="btn g sm" onClick={logout}>Sign out</button></div>
        </div>
      </aside>
      <main><Outlet /></main>
    </div>
  );
}
