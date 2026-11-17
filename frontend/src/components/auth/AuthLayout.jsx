import { Link, Outlet } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import authContent from '../../data/authContent';
import Logo from '../common/Logo';

export default function AuthLayout() {
  const { lang, setLang } = useLanguage();
  const copy = authContent[lang] || authContent.en;

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link to="/" aria-label={copy.backHome}><Logo size="small" /></Link>
        <div className="auth-topbar__actions">
          <label>
            <span className="visually-hidden">{copy.selectLanguage}</span>
            <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label={copy.selectLanguage}>
              <option value="te">తెలుగు</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>
          <Link to="/" className="auth-home-link"><Sprout size={16} aria-hidden="true" />{copy.backHome}</Link>
        </div>
      </header>
      <main className="auth-main"><Outlet /></main>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} AGRISATHI</span><span>{copy.tagline}</span></footer>
    </div>
  );
}
