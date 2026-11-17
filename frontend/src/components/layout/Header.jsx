import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from '../common/Logo';
import { useLanguage } from '../../context/LanguageContext';
import homeContent from '../../data/homeContent';

export default function Header() {
  const { lang, setLang } = useLanguage();
  const copy = homeContent[lang] || homeContent.en;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [lang]);

  const sectionIds = ['home', 'about', 'features', 'how-it-works', 'services', 'contact'];

  useEffect(() => {
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio);
        if (visibleSections[0]) setActiveSection(visibleSections[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.1, 0.25, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
      <div className="site-header__inner">
        <Link className="site-header__brand" to="/" aria-label="AGRISATHI home">
          <Logo size="small" />
        </Link>
        <nav className="site-header__nav" aria-label="Main navigation">
          {copy.nav.map((label, index) => (
            <a className={activeSection === sectionIds[index] ? 'is-active' : ''} key={label} href={`/#${sectionIds[index]}`} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
        </nav>
        <div className="site-header__actions">
          <label className="site-language">
            <span className="visually-hidden">Select language</span>
            <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label="Select language">
              <option value="te">తెలుగు</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>
          <Link className="site-header__login" to="/login">{copy.login}</Link>
          <Link className="site-header__start" to="/register">{copy.getStarted}</Link>
          <button
            className="site-header__menu-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-navigation"
            className="site-mobile-menu"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {copy.nav.map((label, index) => (
              <a className={activeSection === sectionIds[index] ? 'is-active' : ''} key={label} href={`/#${sectionIds[index]}`} onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
            <div className="site-mobile-menu__actions">
              <Link to="/login" onClick={() => setMenuOpen(false)}>{copy.login}</Link>
              <Link className="site-header__start" to="/register" onClick={() => setMenuOpen(false)}>{copy.getStarted}</Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}