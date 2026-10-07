import { Logo, useTheme } from './Layout.jsx';

export default function AuthShell({ title, sub, children, footer }) {
  useTheme();
  return (
    <div className="auth">
      <section className="brand">
        <Logo />
        <h1>Research a business decision in minutes, with sources you can check.</h1>
        <ul>
          <li>Searches the web and your own documents</li>
          <li>Every claim carries a citation</li>
          <li>Built for Pakistani markets, priced in PKR</li>
        </ul>
      </section>
      <section className="form-side">
        <div className="form-card">
          <div className="mobile-logo"><Logo /></div>
          <h2>{title}</h2><p className="sub">{sub}</p>
          {children}
          <p className="alt">{footer}</p>
        </div>
      </section>
    </div>
  );
}
