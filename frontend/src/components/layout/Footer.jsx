import { Link } from 'react-router-dom';
import { ArrowUp, Leaf } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import homeContent from '../../data/homeContent';

const featurePaths = [
  ['/farmer/ai-assistant', 0],
  ['/farmer/crop-doctor', 1],
  ['/farmer/weather', 2],
  ['/farmer/market-prices', 3],
  ['/farmer/schemes', 4],
  ['/farmer/marketplace', 5],
];

export default function Footer() {
  const { lang } = useLanguage();
  const copy = homeContent[lang] || homeContent.en;
  const sectionIds = ['home', 'about', 'features', 'how-it-works', 'services', 'contact'];
  return (
    <footer className="site-footer">
      <div className="home-container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link to="/" className="site-footer__logo"><span><Leaf size={22} /></span><strong>AGRISATHI</strong></Link>
            <p className="site-footer__tagline">{copy.tagline}</p>
            <p>{copy.footer.description}</p>
          </div>
          <div>
            <h2>{copy.footer.quickLinks}</h2>
            <ul>{copy.nav.map((label, index) => <li key={label}><a href={`/#${sectionIds[index]}`}>{label}</a></li>)}</ul>
          </div>
          <div>
            <h2>{copy.footer.features}</h2>
            <ul>{featurePaths.map(([path, index]) => <li key={path}><Link to={path}>{copy.features.items[index][0]}</Link></li>)}</ul>
          </div>
          <div>
            <h2>{copy.footer.support}</h2>
            <ul>
              <li><Link to="/help">{copy.footer.help}</Link></li>
              <li><Link to="/contact">{copy.footer.contact}</Link></li>
              <li><Link to="/privacy">{copy.footer.privacy}</Link></li>
              <li><Link to="/terms">{copy.footer.terms}</Link></li>
              <li><a href="/#farmer-friendly">{copy.footer.accessibility}</a></li>
            </ul>
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} AGRISATHI. {copy.footer.copyright}</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{copy.footer.backToTop}<ArrowUp size={16} aria-hidden="true" /></button>
        </div>
      </div>
    </footer>
  );
}