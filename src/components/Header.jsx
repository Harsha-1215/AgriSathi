import { useCallback } from 'react';

export default function Header({ lang, switchLang, openApp }) {
  const handleSwitchLang = useCallback((newLang) => {
    switchLang(newLang);
  }, [switchLang]);

  return (
    <header>
      <div className="wrap nav">
        <a href="#top" className="brand">
          <svg viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#4B7B3D" />
            <path d="M24 34C24 34 14 28 14 19C14 14.5 17.5 12 21 13.5C22.2 14 23.2 15 24 16.5C24.8 15 25.8 14 27 13.5C30.5 12 34 14.5 34 19C34 28 24 34 24 34Z" fill="#F3E9D2" />
          </svg>
          <span className="brand-text">
            <span className="name">AgriSathi</span>
            <span className="tag">every farmer's need</span>
          </span>
        </a>
        <div className="header-actions">
          <div className="lang-switch" role="group" aria-label="Language preview">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => handleSwitchLang('en')}>English</button>
            <button className={lang === 'te' ? 'active' : ''} onClick={() => handleSwitchLang('te')}>తెలుగు</button>
          </div>
          <button className="btn-login" onClick={openApp}>Login</button>
        </div>
      </div>
    </header>
  );
}